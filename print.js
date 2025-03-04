global.colors = {
    white: '\x1b[37m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    reset: '\x1b[0m'
};

const customConsole = new console.Console(process.stdout);
global.print = (str, color="") => {
    customConsole.log(color + str + colors.reset);
}