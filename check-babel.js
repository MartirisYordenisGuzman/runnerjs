const Babel = require('@babel/standalone');
console.log(JSON.stringify(Object.keys(Babel.availablePlugins).sort(), null, 2));
