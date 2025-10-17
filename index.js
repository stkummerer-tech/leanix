const axios = require('axios');
const cron = require('node-cron');

const {
  LEANIX_BASE_URL,
  LEANIX_API_TOKEN,
  DEFAULT_ACL_VALUE = 'evnat',
  FACTSHEET_TYPE = 'Application',
  CRON_SCHEDULE = '0 2 * * *',
} = process.env;

if (!LEANIX_BASE_URL || !LEANIX_API_TOKEN) {
  throw new Error('LEANIX_BASE_URL and LEANIX_API_TOKEN environment variables must be defined.');
}

const graphqlEndpoint = `${LEANIX_BASE_URL.replace(/\/$/, '')}/services/pathfinder/v1/graphql`;

const graphqlClient = axios.create({
  baseURL: graphqlEndpoint,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${LEANIX_API_TOKEN}`,
  },
});

async function executeGraphQL(query, variables = {}) {
  try {
    const response = await graphqlClient.post('', { query, variables });

    if (response.data.errors) {
      const message = response.data.errors.map((error) => error.message).join('; ');
      throw new Error(message);
    }

    return response.data.data;
  } catch (error) {
    const message = error.response?.data?.errors
      ? error.response.data.errors.map((err) => err.message).join('; ')
      : error.message;
    throw new Error(`GraphQL request failed: ${message}`);
  }
}

async function fetchApplicationFactSheets() {
  const query = `
    query ApplicationFactSheets($cursor: String) {
      allFactSheets(
        filter: {
          facetFilters: [
            {
              facetKey: "FactSheetTypes"
              operator: IN
              keys: ["${FACTSHEET_TYPE}"]
            }
          ]
        }
        first: 200
        after: $cursor
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            displayName
            permittedReadACL
            permittedWriteACL
          }
        }
      }
    }
  `;

  let cursor = null;
  const factSheets = [];

  do {
    const data = await executeGraphQL(query, { cursor });
    const { edges, pageInfo } = data.allFactSheets;

    edges.forEach(({ node }) => factSheets.push(node));
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);

  return factSheets;
}

async function updateFactSheetACL(id, permittedReadACL, permittedWriteACL) {
  const mutation = `
    mutation UpdateFactSheet($id: ID!, $permittedReadACL: [String!], $permittedWriteACL: [String!]) {
      updateFactSheet(
        id: $id
        input: {
          permittedReadACL: $permittedReadACL
          permittedWriteACL: $permittedWriteACL
        }
      ) {
        factSheet {
          id
        }
      }
    }
  `;

  await executeGraphQL(mutation, {
    id,
    permittedReadACL,
    permittedWriteACL,
  });
}

function needsDefaultAcl(values) {
  if (!values) return true;
  if (Array.isArray(values)) {
    return values.length === 0;
  }

  return !values;
}

async function enforceDefaultAcl() {
  console.log(`[${new Date().toISOString()}] Starting ACL enforcement job.`);

  const factSheets = await fetchApplicationFactSheets();
  const updates = [];

  for (const factSheet of factSheets) {
    const { id, displayName, permittedReadACL, permittedWriteACL } = factSheet;

    const newReadACL = needsDefaultAcl(permittedReadACL)
      ? [DEFAULT_ACL_VALUE]
      : permittedReadACL;
    const newWriteACL = needsDefaultAcl(permittedWriteACL)
      ? [DEFAULT_ACL_VALUE]
      : permittedWriteACL;

    const requiresUpdate =
      JSON.stringify(newReadACL) !== JSON.stringify(permittedReadACL) ||
      JSON.stringify(newWriteACL) !== JSON.stringify(permittedWriteACL);

    if (requiresUpdate) {
      updates.push(
        updateFactSheetACL(id, newReadACL, newWriteACL)
          .then(() => console.log(`Updated ACLs for ${displayName} (${id}).`))
          .catch((error) => console.error(`Failed to update ${displayName} (${id}): ${error.message}`)),
      );
    }
  }

  if (updates.length === 0) {
    console.log('No fact sheets required ACL updates.');
  } else {
    await Promise.all(updates);
  }

  console.log(`[${new Date().toISOString()}] ACL enforcement job finished.`);
}

function scheduleJob() {
  cron.schedule(CRON_SCHEDULE, () => {
    enforceDefaultAcl().catch((error) => {
      console.error(`ACL enforcement job failed: ${error.message}`);
    });
  });

  console.log(`Scheduled ACL enforcement job with cron pattern "${CRON_SCHEDULE}".`);
  enforceDefaultAcl().catch((error) => {
    console.error(`Initial ACL enforcement run failed: ${error.message}`);
  });
}

if (require.main === module) {
  scheduleJob();
}

module.exports = {
  enforceDefaultAcl,
  fetchApplicationFactSheets,
  updateFactSheetACL,
  scheduleJob,
};
