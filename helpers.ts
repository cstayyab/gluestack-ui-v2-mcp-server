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

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
    },
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
  const exclude = ['hooks', 'docs-components', 'AllComponents'];
  const list = await getFoldersInGitHubDirectory(
    'gluestack',
    'gluestack-ui',
    'example/storybook-nativewind/src/components'
  );
  return list.filter((v) => exclude.includes(v) == false)
}

export const getComponentUsage = async (componentName: string) => {
  const componentsList = await getGluestackComponentsList();
  if(componentsList.includes(componentName)) {
    const rawComponentUsageURL = `https://raw.githubusercontent.com/gluestack/gluestack-ui/refs/heads/main/example/storybook-nativewind/src/components/${componentName}/index.nw.stories.mdx`
    const response = await fetch(rawComponentUsageURL);
    return await response.text()
  }
  return null;
}

export function pascalToKebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // Insert hyphen between lower/number and upper char
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2') // Handle consecutive uppercase letters followed by lowercase letters
    .toLowerCase();
}
