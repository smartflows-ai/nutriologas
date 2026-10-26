// Structural check for n8n/workflows/n8n-chat-workflow-v2.json
// Verifies connections point at real nodes, $('Name') references resolve, and no node is orphaned.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "workflows", "n8n-chat-workflow-v2.json");
const wf = JSON.parse(fs.readFileSync(file, "utf8"));
const names = new Set(wf.nodes.map((n) => n.name));
let problems = 0;

for (const [source, outputs] of Object.entries(wf.connections)) {
  if (!names.has(source)) {
    console.log("missing source node:", source);
    problems++;
  }
  for (const branches of Object.values(outputs)) {
    for (const branch of branches) {
      for (const link of branch) {
        if (!names.has(link.node)) {
          console.log("missing target node:", source, "->", link.node);
          problems++;
        }
      }
    }
  }
}

const refPattern = /\$\(\\?'([^'\\]+)\\?'\)/g;
for (const node of wf.nodes) {
  const text = JSON.stringify(node.parameters);
  for (const match of text.matchAll(refPattern)) {
    if (!names.has(match[1])) {
      console.log(`node "${node.name}" references missing node "${match[1]}"`);
      problems++;
    }
  }
}

const targets = new Set();
for (const outputs of Object.values(wf.connections)) {
  for (const branches of Object.values(outputs)) {
    for (const branch of branches) for (const link of branch) targets.add(link.node);
  }
}
for (const node of wf.nodes) {
  if (!targets.has(node.name) && !/webhook/i.test(node.type)) {
    console.log("node has no incoming connection:", node.name);
  }
}

console.log(`checked ${wf.nodes.length} nodes, problems: ${problems}`);
process.exitCode = problems ? 1 : 0;
