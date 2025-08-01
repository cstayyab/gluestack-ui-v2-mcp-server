import fs from 'fs';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getChildComponentList, getComponentUsage, getGluestackComponentsList, pascalToKebabCase } from './helpers';

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
    'list_gluestack_components',
    {
      description: 'List all available Gluestack UI v2 components and child components which should only be used as children of the main components.',
      inputSchema: {},
      outputSchema: {
        components: z.array(z.string()),
        child_components: z.record(z.string(), z.array(z.string()))
      },
    },
    async () => {
      const components = await getGluestackComponentsList();
      const child_components: Record<string, string[]> = {}
      for (const component of components) {
        child_components[component] = await getChildComponentList(component);
      }
      const structuredContent = {
        components,
        child_components
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
    'get_gluestack_component_code',
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
    'get_gluestack_component_usage',
    {
      description: 'Get markdown usage (with YAML frontmatter) for a component',
      inputSchema: { componentName: z.string() },
      outputSchema: { usage: z.string(), code: z.string() },
    },
    async ({ componentName }) => {
      const componentList = await getGluestackComponentsList();
      const componentPath = path.join(componentsDir, componentName);
      const customUsageFile = path.join(componentPath, 'usage.mdx');
      if (componentList.includes(componentName)) {
        const structuredContent = {
          usage: fs.existsSync(customUsageFile) ? fs.readFileSync(customUsageFile).toString('utf-8') : await getComponentUsage(componentName) || 'No Usage found.',
        }
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
