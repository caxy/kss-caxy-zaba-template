'use strict';

/**
 * This module is used to load the base KSS builder class needed by this builder
 * and to define any custom CLI options or extend any base class methods.
 *
 * Note: this module is optional. If a builder does not export a KssBuilderBase
 * sub-class as a module, then kss-node will assume the builder wants to use
 * the KssBuilderBaseHandlebars class.
 *
 * This file's name should follow standard node.js require() conventions. It
 * should either be named index.js or have its name set in the "main" property
 * of the builder's package.json. See
 * http://nodejs.org/api/modules.html#modules_folders_as_modules
 *
 * @module kss/builder/handlebars
 */

// We want to extend kss-node's Handlebars builder so we can add options that
// are used in our templates.
let KssBuilderBaseHandlebars;

try {
  // In order for a builder to be "kss clone"-able, it must use the
  // require('kss/builder/path') syntax.
  KssBuilderBaseHandlebars = require('kss/builder/base/handlebars');
} catch (e) {
  // The above require() line will always work.
  //
  // Unless you are one of the developers of kss-node and are using a git clone
  // of kss-node where this code will not be inside a "node_modules/kss" folder
  // which would allow node.js to find it with require('kss/anything'), forcing
  // you to write a long-winded comment and catch the error and try again using
  // a relative path.
  KssBuilderBaseHandlebars = require('../front-end-starter-kit/node_modules/kss/builder/base/handlebars');
}

/**
 * A kss-node builder that takes input files and builds a style guide using
 * Handlebars templates.
 */
class KssBuilderHandlebars extends KssBuilderBaseHandlebars {
  /**
   * Create a builder object.
   */
  constructor() {
    // First call the constructor of KssBuilderBaseHandlebars.
    super();

    // Then tell kss which Yargs-like options this builder adds.
    this.addOptionDefinitions({
      title: {
        group: 'Style guide:',
        string: true,
        multiple: false,
        describe: 'Title of the style guide',
        default: 'KSS Style Guide'
      },
      styleguide_version: {
        group: 'Style guide:',
        string: true,
        multiple: false,
        describe: 'Styleguide version',
        default: '0.0.1'
      },
      hide_pattern_status: {
        group: 'Style guide:',
        string: false,
        multiple: false,
        describe: 'Hide Pattern Status',
        default: true
      },
      sass: {
        group: 'Style guide:',
        string: false,
        multiple: false,
        describe: 'Sass files to process and include',
        default: {
          files: [],
          includePaths: []
        }
      }
    });
  }

  /**
   * Allow the builder to preform pre-build tasks or modify the KssStyleGuide
   * object.
   *
   * The method can be set by any KssBuilderBase sub-class to do any custom
   * tasks after the KssStyleGuide object is created and before the HTML style
   * guide is built.
   *
   * The builder could also take this opportunity to do tasks like special
   * handling of "custom" properties or running Sass or Bower tasks.
   *
   * The parent class sets up access for this builder to an object containing
   * the options of the requested build (as `this.options`), and the global
   * Handlebars object (as `this.Handlebars`).
   *
   * @param {KssStyleGuide} styleGuide The KSS style guide in object format.
   * @returns {Promise.<KssStyleGuide>} A `Promise` object resolving to a
   *   `KssStyleGuide` object.
   */
  prepare(styleGuide) {
    // Process the SASS file and output to the kss-assets directory.
    // We must do this before we call super.prepare since the kss-assets dir
    // is copied to the destination dir in a parent's prepare function.
    const sass = require('node-sass');
    const fs = require('fs-extra');
    const path = require('path');

    // Prepend the caxy-zaba.scss file to array of sass files to compile.
    const cssTarget = path.resolve(__dirname + '/scss/caxy-zaba.scss');
    if (!this.options.sass.files.includes(cssTarget)) {
      this.options.sass.files.unshift(cssTarget);
    }

    // Compiles the sass files passed in from the options and adds them to the css array for kss-node.
    for (let i = 0; i < this.options.sass.files.length; i++) {
      const sourceFile = this.options.sass.files[i];

      if (!/\.(sass|scss)$/.test(path.basename(sourceFile))) {
        continue;
      }

      const cssFile = `kss-assets/styles/${path.basename(sourceFile).replace(/\.(sass|scss)$/, '.css')}`;
      const outputPath = this.options.destination + '/' + cssFile;
      // Add this css file to the kss options, to be included in the template.
      if (!this.options.css.includes(cssFile)) {
        this.options.css.push(cssFile);
      }

      const includePaths = sourceFile === cssTarget
          ? this.options.sass.includePaths.concat(['node_modules/', __dirname + '/scss'])
          : this.options.sass.includePaths;

      // Set default importer for sass if not set.
      if (!this.options.sass.importer) {
        this.options.sass.importer = function (url, prev, done) {
          // Resolve imports starting with ~ to the node_modules dir.
          if (url[0] === '~') {
            url = path.resolve('node_modules', url.substr(1));
          }

          return { file: url };
        }
      }

      // Run SASS to generate the CSS.
      const sassResult = sass.renderSync({
        file: sourceFile,
        includePaths: includePaths,
        importer: this.options.sass.importer
      });

      fs.outputFile(outputPath, sassResult.css, function (err) {
        if (err) {
          console.error(err);
        }
      });
    }

    // First call the prepare() of the parent KssBuilderBaseHandlebars class.
    // Since it returns a Promise, we do our prep work in a then().
    return super.prepare(styleGuide).then(styleGuide => {
      // Load this builder's extra Handlebars helpers.

      // Allow a builder user to override the {{section [reference]}} helper
      // with the --extend setting. Since a user's handlebars helpers are
      // loaded first, we need to check if this helper already exists.
      if (!this.Handlebars.helpers['section']) {
        /**
         * Returns a single section, found by its reference
         * @param  {String} reference The reference to search for.
         */
        this.Handlebars.registerHelper('section', function(reference, options) {
          let section = options.data.root.styleGuide.sections(reference);

          return section.toJSON ? options.fn(section.toJSON()) : options.inverse('');
        });
      }

      // Allow a builder user to override the {{eachSection [query]}} helper
      // with the --extend setting.
      if (!this.Handlebars.helpers['eachSection']) {
        /**
         * Loop over a section query. If a number is supplied, will convert into
         * a query for all children and descendants of that reference.
         * @param  {Mixed} query The section query
         */
        this.Handlebars.registerHelper('eachSection', function(query, options) {
          let styleGuide = options.data.root.styleGuide;

          if (!query.match(/\bx\b|\*/g)) {
            query = query + '.*';
          }
          let sections = styleGuide.sections(query);
          if (!sections.length) {
            return options.inverse('');
          }

          let l = sections.length;
          let buffer = '';
          for (let i = 0; i < l; i += 1) {
            buffer += options.fn(sections[i].toJSON());
          }

          return buffer;
        });
      }

      // Adds markers for different pattern states
      this.Handlebars.registerHelper('statusMarker', function(status) {
        var statusObject = {
          'label' : 'In Development',
          'class' : 'development'
        };
        if (status === 'review') {
          statusObject.label = 'In Review';
          statusObject.class = 'review'
        }
        if (status === 'ready') {
          statusObject.label = 'Production Ready';
          statusObject.class = 'ready'
        }
        return '<span class="kss-status ' + statusObject.class + '">' + statusObject.label + '</span>';
      });

      return Promise.resolve(styleGuide);
    });
  }
}

module.exports = KssBuilderHandlebars;
