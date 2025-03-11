/**
 * Использовать как основной файл при создании exe программы через pkg
 * 
 * Этот файл является модификацией к основный программе для удобства использования консольной версии
 */

//Переменные счетчика открытых запросов (проверка скачивания, загрузка, проверка загрузки)
global.countOfD = global.countOfU = global.countOfCU = 0;

//Создане счетчика 
const logger = require("./logger");
logger.activate();

//Использование модифицированного вывода в консоль
require("./print").setGlobalLoggerPrint(logger);

//Вход в основную программу
require("./index");

//Ожидание закрытия консольного окна
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