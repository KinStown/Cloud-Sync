const logger = {
    start: function() {
        this.tag = setInterval(function() {
            if ((countOfU == 0 && countOfD == 0 && countOfCU == 0) || process.exitCode) {
                logger.stop();
            }
            process.stdout.write(`\rCD: ${global.countOfD}, U: ${global.countOfU}, CU: ${global.countOfCU} `.log);
        }, 70);
    },
    stop: function() {
        clearInterval(this.tag);
        this.tag = null;
    },
    activate: function() {
        this.changeOutput();
        this.activateLoggerTag = setInterval(() => {
            if (process.exitCode) {
                return clearInterval(this.activateLoggerTag);
            }
            if (countOfD > 0 || countOfU > 0 || countOfCU > 0) {
                logger.start();
                clearInterval(this.activateLoggerTag);
            }
        }, 50);
    },
    changeOutput: function() {
        const { stdout } = process;
        customConsole = new console.Console(stdout, process.stderr);

        console.log = (...data) => {
            if (this.tag) {
                stdout.write("\n\x1b[K");
                stdout.moveCursor(0, -1);
            }
            customConsole.log(...data);
        };

        console.error = (...data) => {
            if (this.tag) {
                stdout.write("\n\x1b[K");
                stdout.moveCursor(0, -1);
            }
            customConsole.error(...data);
        }
    } 
};
module.exports = logger;