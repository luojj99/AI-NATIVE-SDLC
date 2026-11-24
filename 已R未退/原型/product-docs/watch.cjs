const fs = require('node:fs');
const path = require('node:path');
const { buildDocs, defaultProject, ruleSource } = require('./build.cjs');
const project = path.resolve(process.argv[2] || defaultProject);
let pending;

function schedule(delay = 650) {
  clearTimeout(pending);
  pending = setTimeout(() => {
    // A checkout can temporarily remove the feature or the rule file.
    if (!fs.existsSync(path.join(project, ruleSource))) return;
    try {
      buildDocs(project);
    } catch (error) {
      console.error(new Date().toISOString(), error.message);
      schedule(15000);
    }
  }, delay);
}

fs.watch(project, (_event, name) => {
  if (!name || name === ruleSource || (!name.startsWith('.') && /\.drawio$/i.test(name))) schedule();
});
schedule(0);
