#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import minimist from 'minimist';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = minimist(process.argv.slice(2));
const forbiddenTemplateSegments = new Set([
  'node_modules',
  'dist',
  'out',
  '.definedmotion',
  'renders',
  'rendered_videos',
  'image_renders',
  'audio_renders'
]);

async function createProject() {
  const projectName = argv._[0];

  if (!projectName) {
    console.error(chalk.red('Error: Please provide a project name'));
    console.log('\nUsage:');
    console.log('  ' + chalk.cyan('create-definedmotion <project-name>'));
    console.log('\nExample:');
    console.log('  ' + chalk.cyan('create-definedmotion my-animation'));
    process.exit(1);
  }

  const targetDir = path.join(process.cwd(), projectName);

  // Check if directory exists
  if (fs.existsSync(targetDir)) {
    console.error(chalk.red(`Error: Directory ${projectName} already exists`));
    process.exit(1);
  }

  console.log(chalk.blue('\n🎬 Creating DefinedMotion project...\n'));

  // Copy template
  const templateDir = path.join(__dirname, '..', 'template');

  console.log(chalk.gray('Creating project structure...'));
  fs.copySync(templateDir, targetDir, {
    filter(source) {
      const relative = path.relative(templateDir, source);
      return !relative.split(path.sep).some((segment) => forbiddenTemplateSegments.has(segment));
    }
  });

  // Update package.json with project name
  const pkgPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = fs.readJsonSync(pkgPath);
    pkg.name = projectName;
    pkg.dependencies.definedmotion = fs.readJsonSync(path.join(__dirname, '..', 'package.json')).version;
    fs.writeJsonSync(pkgPath, pkg, { spaces: 2 });
  }

  // Rename _gitignore to .gitignore if it exists
  const gitignorePath = path.join(targetDir, '_gitignore');
  if (fs.existsSync(gitignorePath)) {
    fs.renameSync(gitignorePath, path.join(targetDir, '.gitignore'));
  }

  console.log(chalk.green('✓') + ' Project structure created');

  // Always skip dependency installation; print next steps instead
  console.log('\n' + chalk.bold.green('✨ Success!') + ' Created ' + chalk.cyan(projectName));
  console.log('\n' + chalk.bold('Next steps:'));
  console.log(chalk.gray('\n  Navigate to your project:'));
  console.log('  ' + chalk.cyan(`cd ${projectName}`));
  console.log(chalk.gray('\n  Install dependencies:'));
  console.log('  ' + chalk.cyan('npm install'));
  console.log(chalk.gray('\n  Start development:'));
  console.log('  ' + chalk.cyan('npm run dev'));
  console.log(chalk.gray('\n  List scenes available to automation:'));
  console.log('  ' + chalk.cyan('npm run dm -- scenes'));
  console.log(chalk.gray('\n  Create your animations in:'));
  console.log('  ' + chalk.cyan('src/scenes/'));
  console.log('\n' + chalk.gray('Need help? Check out the docs:'));
  console.log('  ' + chalk.cyan('https://github.com/HugoOlsson/DefinedMotion'));
  console.log('\n' + chalk.bold('Happy animating! 🚀\n'));
}

// Run
createProject().catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
