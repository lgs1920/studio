module.exports = {
    apps : [{
        name   : "backend",
        script : "/home/.bun/bin/bun run ../../backend/dist/index.js",
        watch : true,
        wait_ready: true
    }]
}