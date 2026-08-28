const fs = require('fs');

let content = fs.readFileSync('app/_pages/Budget.tsx', 'utf8');

const replacement = \                                    <div 
                                        className={\\\h-full \\\\} 
                                        style={{ width: \\\\%\\\ }}
                                    ></div>\;

content = content.replace(/<div\s+className=\{\\\h-full \\\\\}\s+style=\{\{ width: \\\\%\\\\ \}\}\s*><\/div>/g, replacement);

fs.writeFileSync('app/_pages/Budget.tsx', content);
console.log('Fixed Budget.tsx syntax');
