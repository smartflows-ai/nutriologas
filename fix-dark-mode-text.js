const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src'));
let changesCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace exact Tailwind utility combinations with their dark mode counterparts
    content = content.replace(/text-gray-900(?! dark:text-)/g, 'text-gray-900 dark:text-white');
    content = content.replace(/text-gray-800(?! dark:text-)/g, 'text-gray-800 dark:text-gray-100');
    content = content.replace(/text-gray-700(?! dark:text-)/g, 'text-gray-700 dark:text-gray-200');
    content = content.replace(/text-gray-600(?! dark:text-)/g, 'text-gray-600 dark:text-gray-400');
    content = content.replace(/bg-white(?!\/| dark:bg-)/g, 'bg-white dark:bg-gray-900');
    content = content.replace(/bg-gray-50(?!\/| dark:bg-)/g, 'bg-gray-50 dark:bg-gray-950');
    
    // Specifically handle /50 opacities
    content = content.replace(/bg-white\/50(?! dark:bg-)/g, 'bg-white/50 dark:bg-gray-900/50');
    content = content.replace(/bg-gray-50\/50(?! dark:bg-)/g, 'bg-gray-50/50 dark:bg-gray-950/50');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changesCount++;
        console.log('Fixed:', file);
    }
});

console.log('Total files fixed:', changesCount);
