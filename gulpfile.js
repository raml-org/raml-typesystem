var gulp = require('gulp');
var typedoc = require("gulp-typedoc");
gulp.task("typedoc", function() {
    return gulp
        .src(["src/index.ts"])
        .pipe(typedoc({
            module: "commonjs",
            target: "es5",
            out: "docs/",
            name: "RAML TypeSystem",
            hideGenerator: true,
            excludeExternals: true,
            mode: "file",
            readme:"readme.txt"
        }))
        ;
});
