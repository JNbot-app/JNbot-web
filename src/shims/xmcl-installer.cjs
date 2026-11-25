// @xmcl/installer for the browser: only listing Minecraft versions works (the
// version pickers need it). Installing Minecraft, loaders or Java throws.
// Mojang, Fabric and Quilt send CORS headers, so `fetch` reaches them directly.
const unsupported = (name) => () => {
  throw new Error(`${name} is not supported in the browser version of JNbot.`);
};

exports.DEFAULT_VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
exports.DEFAULT_META_URL_FABRIC = 'https://meta.fabricmc.net';
exports.DEFAULT_META_URL_QUILT = 'https://meta.quiltmc.org';
exports.DEFAULT_RUNTIME_ALL_URL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';

exports.getVersionList = async (options = {}) => {
  const response = await (options.fetch ?? fetch)(options.remote ?? exports.DEFAULT_VERSION_MANIFEST_URL);
  if (!response.ok) throw new Error(`Failed to fetch the Minecraft version list: HTTP ${response.status}`);
  return response.json();
};

for (const name of [
  'getForgeVersionList', 'getLabyModManifest', 'getLoaderArtifactListFor', 'getQuiltLoaderVersionsByMinecraft',
  'installVersion', 'installDependencies', 'installDependenciesTask', 'installFabric', 'installJavaRuntimeTask',
  'installQuiltVersion', 'installForge', 'installLaby4Mod', 'generateOptifineVersion',
]) exports[name] = unsupported(name);
