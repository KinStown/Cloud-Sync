//Использовать как основной файл при создании exe программы через pkg
//Или как файл запуска при компиляции через sea

//Счетчики открытых подпроцессов
global.countOfD = global.countOfU = global.countOfCU = 0;

require("./print");

//Модификация вывода для работы logger'а
global.print = (str, color="") => {
    str = color + str + colors.reset;
    if (!logger) {
        console.log(str);
        return;
    }
    stdout.moveCursor(0, -1); // up one line
    stdout.write("\n" + str + "\n");
};

require("./index");

const { stdout } = process;

const logger = {
    start: function() {
        this.tag = setInterval(function() {
            if ((countOfU == 0 && countOfD == 0 && countOfCU == 0) || process.exitCode) {
                logger.stop();
            }
            stdout.write(`\rD: ${global.countOfD}, U: ${global.countOfU}, check U: ${global.countOfCU} `);
        }, 50);
    },
    stop: function() {
        clearInterval(this.tag);
        this.tag = null;
    }
};

const activateLogger = setInterval(() => {
    if (process.exitCode) {
        return clearInterval(activateLogger);
    }
    if (countOfD > 0 || countOfU > 0 || countOfCU > 0) {
        logger.start();
        clearInterval(activateLogger);
    }
}, 50);

process.once("beforeExit", (code) => {
    console.log(`\n[ ${process.uptime().toPrecision(3)}s ] Код завершения: ${code}.\nНажмите любую клавишу для выхода.`);
    const stdin = process.stdin;
    stdin.setRawMode( true );
    stdin.setEncoding( 'utf8' );
    stdin.resume();
  
    stdin.on('data', function( key ) {
        stdin.destroy();
        process.exit();
    });
});