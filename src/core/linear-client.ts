import axios from 'axios';
import { LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class LinearClient {
  private apiKey: string;
  private baseURL = 'https://api.linear.app/graphql';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getIssue(issueIdentifier: string): Promise<LinearIssue | null> {
    try {
      logger.info('📋 Fetching Linear issue', { issueIdentifier });

      const query = `
        query GetIssues($first: Int!) {
          issues(first: $first) {
            nodes {
              id
              identifier
              title
              description
              url
              state { name }
              assignee { id name }
              team { id name key }
              labels { nodes { id name } }
            }
          }
        }
      `;

      const response = await axios.post(this.baseURL, {
        query,
        variables: { first: 100 }
      }, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        logger.error('Linear API errors', { errors: response.data.errors });
        return null;
      }

      const issues = response.data.data?.issues?.nodes;
      const issueData = issues?.find((issue: any) => issue.identifier === issueIdentifier);
      
      if (!issueData) {
        logger.warn('Issue not found', { issueIdentifier });
        return null;
      }

      const linearIssue: LinearIssue = {
        id: issueData.id,
        identifier: issueData.identifier,
        title: issueData.title,
        description: issueData.description,
        status: issueData.state?.name || 'Unknown',
        assignee: issueData.assignee ? {
          id: issueData.assignee.id,
          name: issueData.assignee.name
        } : undefined,
        team: {
          id: issueData.team.id,
          name: issueData.team.name,
          key: issueData.team.key
        },
        labels: issueData.labels?.nodes?.map((label: any) => ({
          id: label.id,
          name: label.name
        })) || [],
        url: issueData.url
      };

      logger.info('✅ Successfully fetched Linear issue', {
        issueId: linearIssue.identifier,
        title: linearIssue.title
      });

      return linearIssue;
    } catch (error) {
      logger.error('Failed to fetch Linear issue', { issueIdentifier, error });
      return null;
    }
  }
}
