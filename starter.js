//Использовать как основной файл при создании .exe программы
require("./index");

process.once("beforeExit", (code) => {
    console.log(`\nКод завершения процесса: ${code}.\nНажмите любую клавишу для выхода.`);
    const stdin = process.stdin;
    stdin.setRawMode( true );
    stdin.resume();

    stdin.setEncoding( 'utf8' );

    stdin.on('data', function( key ) {
        process.exit();
    });
});