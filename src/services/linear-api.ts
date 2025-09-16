import axios from 'axios';
import { LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class LinearAPI {
  private apiKey: string;
  private baseURL = 'https://api.linear.app/graphql';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getIssue(issueIdentifier: string): Promise<LinearIssue | null> {
    try {
      const query = `
        query GetIssues($first: Int!) {
          issues(first: $first) {
            nodes {
              id
              identifier
              title
              description
              url
              estimate
              priority
              state { name }
              assignee { id name }
              team { id name key }
              labels { nodes { id name } }
              comments { nodes { id body createdAt user { name } } }
              attachments { nodes { id title url subtitle } }
              parent { id identifier title }
              children { nodes { id identifier title } }
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
      
      if (!issueData) return null;

      return {
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
        estimate: issueData.estimate,
        priority: issueData.priority,
        url: issueData.url,
        comments: issueData.comments?.nodes?.map((comment: any) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          user: { name: comment.user.name }
        })) || [],
        attachments: issueData.attachments?.nodes?.map((attachment: any) => ({
          id: attachment.id,
          title: attachment.title,
          url: attachment.url,
          subtitle: attachment.subtitle
        })) || [],
        parent: issueData.parent ? {
          id: issueData.parent.id,
          identifier: issueData.parent.identifier,
          title: issueData.parent.title
        } : undefined,
        children: issueData.children?.nodes?.map((child: any) => ({
          id: child.id,
          identifier: child.identifier,
          title: child.title
        })) || []
      };
    } catch (error) {
      logger.error('Failed to fetch issue from Linear API', { issueIdentifier, error });
      return null;
    }
  }
}
