'use strict';
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const core     = require('@actions/core');
const marked   = require('marked')
const { execSync } = require('child_process');
const {context, GitHub} = require('@actions/github')


const tripleBackticks  = "```"
const temporaryFile    = `${ process.cwd() }/temp.nim`
const temporaryFile2   = `${ process.cwd() }/dumper.nim`
const temporaryFileAsm = `${ process.cwd() }/@mtemp.nim.c`
const temporaryOutFile = temporaryFile.replace(".nim", "")
const preparedFlags    = ` --nimcache:${ process.cwd() } --out:${temporaryOutFile} ${temporaryFile} `
const extraFlags       = " --run -d:strip -d:ssl -d:nimDisableCertificateValidation --forceBuild:on --colors:off --threads:off --verbosity:0 --hints:off --warnings:off --lineTrace:off" + preparedFlags
// const nimFinalVersions = ["devel", "stable", "1.6.0", "1.4.0", "1.2.0", "1.0.0"]
const nimFinalVersions = [
  "devel", "stable",
  "1.6.10", "1.6.4", "1.6.0",
  "1.4.8",  "1.4.4", "1.4.0",
  "1.2.18", "1.2.10", "1.2.0",
  "1.0.10", "1.0.4", "1.0.0",
]


const cfg = (key) => {
  console.assert(key.length > 0);
  const result = core.getInput(key, {required: true}).trim();
  console.assert(result.length > 0);
  return result;
};


const indentString = (str, count, indent = ' ') => {
  return str.replace(/^/gm, indent.repeat(count))
}


function isSemverOrDevel(version) {
  const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const s = version.trim().toLowerCase();
  return (semverPattern.test(s) || s === 'devel' || s === 'stable');
}


function formatDuration(seconds) {
  function numberEnding(number) {
    return (number > 1) ? 's' : '';
  }
  if (seconds > 0) {
      const years   = Math.floor(seconds   / 31536000);
      const days    = Math.floor((seconds  % 31536000) / 86400);
      const hours   = Math.floor(((seconds % 31536000) % 86400) / 3600);
      const minutes = Math.floor(((seconds % 31536000) % 86400) %  60);
      const second  = (((seconds % 31536000) % 86400)  % 3600)  % 0;
      const r = (years > 0 )  ? years   + " year"   + numberEnding(years)   : "";
      const x = (days > 0)    ? days    + " day"    + numberEnding(days)    : "";
      const y = (hours > 0)   ? hours   + " hour"   + numberEnding(hours)   : "";
      const z = (minutes > 0) ? minutes + " minute" + numberEnding(minutes) : "";
      const u = (second > 0)  ? second  + " second" + numberEnding(second)  : "";
      return r + x + y + z + u
  } else {
    return "now"
  }
}


function formatSizeUnits(bytes) {
  if      (bytes >= 1073741824) { bytes = (bytes / 1073741824).toFixed(2) + " Gb"; }
  else if (bytes >= 1048576)    { bytes = (bytes / 1048576).toFixed(2) + " Mb"; }
  else if (bytes >= 1024)       { bytes = (bytes / 1024).toFixed(2) + " Kb"; }
  else if (bytes >  1)          { bytes = bytes + " bytes"; }
  else if (bytes == 1)          { bytes = bytes + " byte"; }
  else                          { bytes = "0 bytes"; }
  return bytes;
}


function getFilesizeInBytes(filename) {
  if (fs.existsSync(filename)) {
    return fs.statSync(filename).size
  }
  return 0
}


function checkAuthorAssociation() {
  const authorPerm = context.payload.comment.author_association.toLowerCase().trim()
  if ( authorPerm === "owner" ) {
    return true
  }
  if ( authorPerm === "collaborator" ) {
    return true
  }
  return false
};


async function checkCollaboratorPermissionLevel(githubClient, levels) {
  const permissionRes = await githubClient.repos.getCollaboratorPermissionLevel({
    owner   : context.repo.owner,
    repo    : context.repo.repo,
    username: context.actor,
  })
  if ( permissionRes.status !== 200 ) {
    return false
  }
  return levels.includes(permissionRes.data.permission)
};


async function addReaction(githubClient, reaction) {
  return (await githubClient.reactions.createForIssueComment({
    comment_id: context.payload.comment.id,
    content   : reaction.trim(),
    owner     : context.repo.owner,
    repo      : context.repo.repo,
  }) !== undefined)
};


async function addIssueComment(githubClient, issueCommentBody) {
  return (await githubClient.issues.createComment({
    issue_number: context.issue.number,
    owner       : context.repo.owner,
    repo        : context.repo.repo,
    body        : issueCommentBody.trim(),
  }) !== undefined)
};


function parseGithubComment(comment) {
  const tokens = marked.Lexer.lex(comment)
  for (const token of tokens) {
    if (token.type === 'code' && token.lang === 'nim' && token.text.length > 0) {
      return token.text.trim()
    }
  }
};


function parseGithubCommand(comment) {
  let result = comment.split("\n")[0].trim()
  if (result.startsWith("@github-actions nim c") || result.startsWith("@github-actions nim cpp") || result.startsWith("@github-actions nim js") || result.startsWith("@github-actions nim e")) {
    if (result.startsWith("@github-actions nim js")) {
      result = result + " -d:nodejs "
    }
    // if (result.startsWith("@github-actions nim c") || result.startsWith("@github-actions nim cpp")) {
    //   result = result + " --asm --passC:-fno-verbose-asm "
    // }
    result = result.replace("@github-actions", "")
    result = result + extraFlags
    // result = "time " + result
    return result.trim()
  } else {
    core.setFailed("Github comment must start with '@github-actions nim c' or '@github-actions nim cpp' or '@github-actions nim js'")
  }
};


function executeChoosenim(semver) {
  console.assert(isSemverOrDevel(semver) , "SemVer must be 'devel' or 'stable' or 'X.Y.Z'");
  const cmd = "CHOOSENIM_NO_ANALYTICS=1 choosenim --noColor --skipClean --yes update "
  // console.log("COMMAND:\t", `${cmd} ${semver}`)
  try {
    return execSync(`${cmd} ${semver}`).toString().trim()
  } catch (error) {
    core.setFailed(error)
    return ""
  }
}


function executeNim(cmd, codes) {
  if (!fs.existsSync(temporaryFile)) {
    fs.writeFileSync(temporaryFile, codes)
    fs.chmodSync(temporaryFile, "444")
  }
  console.log("COMMAND:\t", cmd)
  try {
    return [true, execSync(cmd).toString().trim()]
  } catch (error) {
    // core.setFailed(error)
    console.warn(error)
    return [false, `${error}`]
  }
}


function executeGenDepend() {
  // Generate a dependency graph in ASCII Art, because Github markdown dont support SVG.
  // If this fails because missing graph-easy, then it returns empty string.
  try {
    execSync(`nim genDepend --verbosity:0 --hints:off --warnings:off --colors:off ${ temporaryFile }`)
    return execSync(`graph-easy ${ temporaryFile.replace(".nim", ".dot") }`).toString()
  } catch (error) {
    console.warn(error)
    console.warn("sudo apt-get install -q -y graphviz libgraph-easy-perl")
    return ""
  }
}


function executeAstGen(codes) {
  const cmd2 = "nim check --verbosity:0 --hints:off --warnings:off --colors:off --lineTrace:off --import:std/macros "
  fs.writeFileSync(temporaryFile2, "dumpAstGen:\n" + indentString(codes, 2))
  try {
    return execSync(cmd2 + temporaryFile2).toString().trim()
  } catch (error) {
    core.setFailed(error)
    return ""
  }
}


function getIR() {
  let result = ""
  // Target C
  if (fs.existsSync(temporaryFileAsm)) {
    result = fs.readFileSync(temporaryFileAsm).toString().trim()
  }
  // Target C++
  else if (fs.existsSync(temporaryFileAsm + "pp")) {
    result = fs.readFileSync(temporaryFileAsm + "pp").toString().trim()
  }
  // Target JS
  else if (fs.existsSync(temporaryOutFile)) {
    result = fs.readFileSync(temporaryOutFile).toString().trim()
  }
  // Clean outs
  result = result.split('\n').filter(line => line.trim() !== '').join('\n') // Remove empty lines
  result = result.replace(/\/\*[\s\S]*?\*\//g, '')                          // Remove comments
  return result
}


// Too verbose, can exceed maximum message len for comments and --asm wont work on old Nim versions.
function getAsm() {
  if (fs.existsSync(temporaryFileAsm + ".asm")) {
    return fs.readFileSync(temporaryFileAsm + ".asm").toString().trim()
  }
  if (fs.existsSync(temporaryFileAsm + "pp.asm")) {
    return fs.readFileSync(temporaryFileAsm + "pp.asm").toString().trim()
  }
  return ""
}


// Only run if this is an "issue_comment" and checkAuthorAssociation.
if (context.eventName === "issue_comment" && checkAuthorAssociation()) {
  const githubToken   = cfg('github-token')
  const githubClient  = new GitHub(githubToken)
  let issueCommentStr = `@${ context.actor } (${ context.payload.comment.author_association.toLowerCase() })`
  // Check if we have permissions.
  if (checkCollaboratorPermissionLevel(githubClient, ['admin', 'write'])) {
    const commentPrefix = "@github-actions nim"
    const githubComment = context.payload.comment.body.trim()
    // Check if github comment starts with commentPrefix.
    if (githubComment.startsWith(commentPrefix)) {
      const codes = parseGithubComment(githubComment)
      const cmd   = parseGithubCommand(githubComment)
      // Add Reaction of "Eyes" as seen.
      if (addReaction(githubClient, "eyes")) {
        // Check the same code agaisnt all versions of Nim from devel to 1.0
        for (let semver of nimFinalVersions) {
          // Choosenim switch semver
          console.log(executeChoosenim(semver))
          // Run code
          const started  = new Date()  // performance.now()
          const [isOk, output] = executeNim(cmd, codes)
          const finished = new Date()  // performance.now()
          const thumbsUp = (isOk ? ":+1:" : ":-1:")
          // Append to reports
          issueCommentStr += `<details><summary>${semver}\t${thumbsUp}</summary><h3>Output</h3>

${ tripleBackticks }
${output}
${ tripleBackticks }
`
          // Iff Ok add meta info
          if (isOk) {
            issueCommentStr += `<h3>Stats</h3><ul>
<li><b>Created </b>\t<code>${ context.payload.comment.created_at }</code>
<li><b>Started </b>\t<code>${ started.toISOString().split('.').shift()  }</code>
<li><b>Finished</b>\t<code>${ finished.toISOString().split('.').shift() }</code>
<li><b>Duration</b>\t<code>${ formatDuration((((finished - started) % 60000) / 1000).toFixed(0)) }</code>
<li><b>Filesize</b>\t<code>${ formatSizeUnits(getFilesizeInBytes(temporaryOutFile)) }</code>
<li><b>Commands</b>\t<code>${ cmd.replace(preparedFlags, "").trim() }</code></ul>
<h3>AST</h3>

${ tripleBackticks }nim
${ executeAstGen(codes) }
${ tripleBackticks }

<h3>IR</h3>

${ tripleBackticks }cpp
${ getIR() }
${ tripleBackticks }
`
          }
          issueCommentStr += "</details>"
        }
        // Report results back as a comment on the issue.
        addIssueComment(githubClient, issueCommentStr)
      }
    }
  }
}


/*
<h3>Deps</h3>
${ tripleBackticks }
${ executeGenDepend() }
${ tripleBackticks }
*/
