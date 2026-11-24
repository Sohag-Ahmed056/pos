const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const files = (dir) => {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
            e.isDirectory()
                ? files(path.join(dir, e.name))
                : e.name.endsWith('.js')
                  ? [path.join(dir, e.name)]
                  : []
        );
};
for (const file of [...files('src'), ...files('tests'), ...files('scripts')]) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.status) process.exit(result.status);
}
const source = files('src')
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
if (/config\/prisma|new PrismaClient|sequelize|typeorm/i.test(source))
    throw new Error('ORM dependency found');
console.log('Backend syntax and direct-SQL architecture checks passed.');
