import fs from 'fs';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getComponentUsage, getGluestackComponentsList, pascalToKebabCase } from './helpers';

type ComponentFile = {
  path: string;
  content: string;
};

type ComponentEntry = {
  files: ComponentFile[];
  usage: string;
};

// Load all component JSON files from the components directory
const componentsDir = path.join(__dirname, 'components');

const serverInfo = {
  name: 'gluestack-ui-v2',
  version: '1.0.0',
  title: 'Gluestack UI v2 MCP Server'
}

export async function createServer() {
  const server = new McpServer(
    serverInfo
  );

  server.registerTool(
    'list_components',
    {
      description: 'List all available Gluestack UI v2 components',
      inputSchema: {},
      outputSchema: { components: z.array(z.string()) }
    },
    async () => {
      const structuredContent = {
        components: await getGluestackComponentsList()
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structuredContent)
          }
        ], structuredContent
      }
    }
  );

  server.registerTool(
    'get_component_code',
    {
      description: 'Get all source files for a Gluestack UI v2 component',
      inputSchema: { componentName: z.string() },
      outputSchema: {
        files: z.array(
          z.object({
            path: z.string(),
            content: z.string(),
          })
        ),
      },
    },
    async ({ componentName }) => {
      const componentList = await getGluestackComponentsList();
      const kebabComponentName = pascalToKebabCase(componentName);
      const componentPath = path.join(componentsDir, kebabComponentName);
      if (componentList.includes(componentName) && fs.existsSync(componentPath)) {
        const filenames = fs.readdirSync(componentPath, {
          encoding: 'utf-8'
        })
        const files = filenames.map((filename) => {
          const filepath = `${componentName}/${filename}`
          const content = fs.readFileSync(path.join(componentPath, filename), {
            encoding: 'utf-8'
          });
          const fileObj = {
            path: filepath,
            content
          }
          return fileObj
        })
        const strucutredContent = { files }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(strucutredContent)
            }
          ],
          strucutredContent
        };
      } else {
        throw new Error('Component not found.')
      }

    }
  );

  server.registerTool(
    'get_component_usage',
    {
      description: 'Get markdown usage (with YAML frontmatter) for a component',
      inputSchema: { componentName: z.string() },
      outputSchema: { usage: z.string() },
    },
    async ({ componentName }) => {
      const componentList = await getGluestackComponentsList();
      const componentPath = path.join(componentsDir, componentName);
      if (componentList.includes(componentName)) {
        const structuredContent = { usage: await getComponentUsage(componentName) }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(structuredContent)
            }
          ],
          structuredContent
        };
      } else {
        throw new Error('Component not found.')
      }

    }
  );

  await server.connect(
    new StdioServerTransport()
  );

  return server
}

// If run directly via `npm run dev` or `node server.js`, start the server
createServer().then((server) => {
  console.log(`[${serverInfo.title}] Server Started via Stdin`)
}).catch((err) => {
  console.error(err);
});
