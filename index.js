'use strict';
const fs       = require('fs');
const path     = require('path');
const core     = require('@actions/core');
const { exec } = require('child_process');
const {context, GitHub} = require('@actions/github')


const cfg = (key) => {
  console.assert(key.length > 0);
  const result = core.getInput(key, {required: true}).trim();
  console.assert(result.length > 0);
  return result;
};


// const walk = (startPath, callback) => {
//   console.assert(startPath.length > 0);
//   var counter = 0;
//   if (!fs.existsSync(startPath)) {
//     return;
//   }
//   var files = fs.readdirSync(startPath);
//   for (var i = 0; i < files.length; i++) {
//     var filename = path.join(startPath, files[i]);
//     var stat = fs.lstatSync(filename);
//     if (stat.isDirectory()) {
//         walk(filename, callback);
//     } else {
//       if (filename.length > 0 && filename[0] != "." && filename.substr(filename.length - 4, filename.length) == ".nim") {
//         console.log(counter + "\t" + filename);
//         counter++;
//         callback(filename);
//       }
//     }
//   };
// };


// const walks = (currentValue, index) => {
//   console.assert(currentValue.length > 0);
//   console.log("\nfolder\t'" + currentValue + "'");
//   const verbose = cfg('verbose') === "true";
//   walk(currentValue, function (filename) {
//     const cmd = `nimlint --verbose:${ verbose } --output:${ filename } --input:${ filename }`;
//     if (verbose) {
//       console.log(cmd);
//     };
//     exec(cmd, (err, stdout, stderr) => {
//       if (err) {
//         core.setFailed(`${stderr} ${stdout} ${err}`);
//         return;
//       };
//     });
//   });
// };



if (context.eventName === "issue_comment") {
  const githubToken = cfg('github-token')
  const githubClient = new GitHub(githubToken)
  const permissionRes = await githubClient.repos.getCollaboratorPermissionLevel({
    owner   : context.repo.owner,
    repo    : context.repo.repo,
    username: context.actor,
  })
  if (permissionRes.status === 200) {
    if (['admin', 'write', /* 'read' */ ].includes(permissionRes.data.permission)) {
      console.warn("HERE");
    }
  }
}




// try {

//   const nimlintInstall = "nimble -y --noColor install https://github.com/nim-compiler-dev/nimlint.git";
//   exec(nimlintInstall, (err, stdout, stderr) => {
//     if (err) {
//       core.setFailed(`${stderr} ${stdout} ${err}`);
//       return;
//     } else {
//       cfg('folders').split(',').forEach(walks);
//     };
//   });
// } catch (error) {
//   core.setFailed(`${stderr} ${stdout} ${err}`);
// }
// }
