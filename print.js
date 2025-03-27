/**
 * Модуль используется для вывода в консоль цветного текста и вывода в консоль счетчиков
 */

const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",

    white: '\x1b[37m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    black: "\x1b[30m",

    bgBlack: "\x1b[40m",
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
    bgWhite: "\x1b[47m",
    bgGray: "\x1b[100m",
};

const defaultPrint = (str, color="") => {
    if (color)
        str = color + str + colors.reset;
    console.log(str);
}
defaultPrint.error = (err) => {
    if (typeof err == "string")
        return print(err, colors.red);
    return console.error(err);
}

//Обычная версия функции вывода с цветами
function setGlobalPrint() {
    global.print = defaultPrint;
    global.colors = colors;
}

//Модификация функции вывода для работы logger'а
function setGlobalLoggerPrint(logger) {
    const { stdout } = process;

    global.colors = colors;

    global.print = (str, color="") => {      
        if (!logger.tag)
            return defaultPrint(str, color);

        if (color)
            str = color + str + colors.reset;

        stdout.moveCursor(0, -1);
        stdout.write("\n\x1b[K" + str + "\n");
    };

    global.print.error = (err) => {
        if (!logger.tag)
            return defaultPrint.error(err);
        
        let msg;
        if (err.stack) { // Для ошибок, созданных через new Error()
            err.stack = err.stack.split("\n");
            err.stack[0] = colors.red + err.stack[0] + colors.reset;
            err.stack[1] += colors.gray;
            msg = err.stack.join("\n") + colors.reset;
        }
        else { // Для строковых ошибок
            msg = colors.red + err + colors.reset;
        }
        
        stdout.moveCursor(0, -1);
        stdout.write("\n\x1b[K" + msg + "\n");  
    }
}

module.exports = { colors, setGlobalPrint, setGlobalLoggerPrint };