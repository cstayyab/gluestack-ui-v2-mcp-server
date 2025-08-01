import * as ts from 'typescript';
import * as fs from 'fs';
import path from 'path';


const componentsDir = path.join(__dirname, 'components');

/**
 * Get list of folders in a GitHub repo directory
 * @param owner - Repository owner/user
 * @param repo - Repository name
 * @param path - Directory path inside the repo
 * @param branch - Branch name (default is main)
 * @returns Promise<string[]> - List of folder names
 */
async function getFoldersInGitHubDirectory(
  owner: string,
  repo: string,
  path: string,
  branch = 'main'
): Promise<string[]> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  }
  const token = process.env.GH_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  const response = await fetch(apiUrl, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Filter folders
  const folders = data
    .filter((item: any) => item.type === 'dir')
    .map((folder: any) => folder.name);

  return folders;
}

export const getGluestackComponentsList = async () => {
  const exclude = ['hooks', 'docs-components', 'AllComponents', 'BottomSheet', 'ImageViewer', 'PinInput'];
  const list = await getFoldersInGitHubDirectory(
    'gluestack',
    'gluestack-ui',
    'example/storybook-nativewind/src/components',
    'patch'
  );
  const excludedFiltered = list.filter((v) => exclude.includes(v) == false);
  return excludedFiltered.filter((c) => fs.existsSync(path.join(componentsDir, pascalToKebabCase(c))))
}

export const getChildComponentList = async (componentName: string) => {
  const componentsList = await getGluestackComponentsList();
  if (componentsList.includes(componentName)) {
    const componentFile = path.join(componentsDir, pascalToKebabCase(componentName), 'index.tsx')
    const exported = parseTSXForExportedMembers(componentFile);
    return exported.filter(c => c !== componentName);
  } else {
    throw Error('Invalid Component Name.');
  }
}

export const getComponentUsage = async (componentName: string) => {
  const componentsList = await getGluestackComponentsList();
  if (componentsList.includes(componentName)) {
    const rawComponentUsageURL = `https://raw.githubusercontent.com/gluestack/gluestack-ui/refs/heads/main/example/storybook-nativewind/src/components/${componentName}/index.nw.stories.mdx`
    const response = await fetch(rawComponentUsageURL);
    return await response.text()
  }
  return null;
}

export function pascalToKebabCase(input: string): string {
  const rv = input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // Insert hyphen between lower/number and upper char
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2') // Handle consecutive uppercase letters followed by lowercase letters
    .toLowerCase();
  if (rv.split('-')[0].length == 1) { //special case for hstack and vstack
    return rv.replace('-', '');
  }
  return rv
}

export const parseTSXForExportedMembers = (filePath: string) => {
  // Read the TypeScript file
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  // Parse the file content into a TypeScript AST (Abstract Syntax Tree)
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  // Function to extract exported members
  const extractExportedMembers = (node: ts.Node): string[] => {
    const exportedMembers: string[] = [];

    // Traverse the AST to find exported declarations
    ts.forEachChild(node, (childNode) => {
      if (ts.isExportDeclaration(childNode)) {
        // Handling named exports
        if (childNode.exportClause && ts.isNamedExports(childNode.exportClause)) {
          childNode.exportClause.elements.forEach((element) => {
            exportedMembers.push(element.name.getText());
          });
        }
      } else if (ts.isExportAssignment(childNode)) {
        // Handling default export
        exportedMembers.push('default');
      } else {
        // Recurse into child nodes
        exportedMembers.push(...extractExportedMembers(childNode));
      }
    });

    return exportedMembers;
  };

  // Extract exported members from the AST
  const exportedMembers = extractExportedMembers(sourceFile);

  return exportedMembers;
};
