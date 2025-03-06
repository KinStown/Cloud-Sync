const logger = {
    start: function() {
        this.tag = setInterval(function() {
            if ((countOfU == 0 && countOfD == 0 && countOfCU == 0) || process.exitCode) {
                logger.stop();
            }
            process.stdout.write(`\rD: ${global.countOfD}, U: ${global.countOfU}, CU: ${global.countOfCU} `);
        }, 70);
    },
    stop: function() {
        clearInterval(this.tag);
        this.tag = null;
    },
    activate: function() {
        this.activateLoggerTag = setInterval(() => {
            if (process.exitCode) {
                return clearInterval(this.activateLoggerTag);
            }
            if (countOfD > 0 || countOfU > 0 || countOfCU > 0) {
                logger.start();
                clearInterval(this.activateLoggerTag);
            }
        }, 50);
    } 
};
module.exports = logger;