module.exports = {
  apps: [
    {
      name: "fairprice",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "1G",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      time: true,
    },
  ],
};
