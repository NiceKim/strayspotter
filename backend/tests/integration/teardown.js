const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  execSync('docker compose -f docker-compose.test.yml down', {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit',
  });
};
