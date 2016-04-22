CogniCity
=========
**Open Source GeoSocial Intelligence Framework**

#### cognicity-rem-web: Frontend web interface for REM server.

[![Build Status](https://smart-analytics.eis.uow.edu.au/Jenkins/buildStatus/icon?job=cognicity-rem-web-test)](https://smart-analytics.eis.uow.edu.au/Jenkins/job/cognicity-rem-web-test/)

The platform runs on the open source software known as [CogniCity](http://cognicity.info/). This GeoSocial Intelligence framework allows data to be collected and disseminated by community members through their location-enabled mobile devices to map information about flooding and water infrastructure in real-time.

## Compiling the Site

We use [Grunt](http://gruntjs.com/) with various third-party tasks to work with the site's source code. It's how we build the site, run tests, and more. To use it, install the required dependencies as directed and then run it from the command line.

### Install Grunt

From the command line:

1. Install `grunt-cli` globally with `npm install -g grunt-cli`.
2. Navigate to the root `/cognicity-rem-web` directory, then run `npm install`. npm will look at [package.json](https://github.com/twbs/bootstrap/blob/master/package.json) and automatically install the necessary local dependencies listed there.

When completed, you'll be able to run the various Grunt commands provided from the command line.

**Unfamiliar with npm? Don't have node installed?** That's a-okay. npm stands for [node packaged modules](http://npmjs.org/) and is a way to manage development dependencies through node.js. [Download and install node.js](http://nodejs.org/download/) before proceeding.

### Available Grunt Commands

#### Build - `grunt`
Run `grunt` to build the whole site, with the resulting files placed in the `build/` directory.

#### Compile assets - `grunt assets`
Run `grunt assets` to compile the site's CSS and JS files into single, minified files.

#### Build HTML - `grunt site`
Fill in the site's HTML templates with strings for each of the various translations available, with the output in `/build/:language`.

#### Update build for development - `grunt dev`
Update assets from the already built site to aid development. Copies un-minified JavaScript into the build folder.

### Rebuild Site on Changes - `grunt watch`
Watches for changes in the `assets` directory and rebuilds the site when they change. Useful during development. Does not minify javascript.

### Launch a Server - `grunt server`
Builds the site and launches a barebones server to serve up files in the `\build` directory. This command also concurrently runs the `watch` command to update files as they change.

### Generate Documentation - `grunt docs`
Generates documentation from the site's JavaScript files using [JSDoc](http://usejsdoc.org/)

## Contribution Guidelines

The site should be compiled with the `grunt` command before committing, this way there'll always be a pre-built, up to date version of the site included with the repo.

### Release

The release procedure is as follows:
* Update the CHANGELOG.md file with the newly released version, date, and a high-level overview of changes. Commit the change.
* Update JSDoc documentation if required (see above).
* Create a tag in git from the current head of master. The tag version should be the same as the version specified in the package.json file - this is the release version.
* Update the version in the package.json file and commit the change.
* Further development is now on the updated version number until the release process begins again.
