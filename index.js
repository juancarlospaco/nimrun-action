'use strict';
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const core     = require('@actions/core');
const { execSync } = require('child_process');
const {context, GitHub} = require('@actions/github')
const marked = require('marked')
const temporaryFile = `${ process.cwd() }/temp.nim`
const temporaryOutFile = temporaryFile.replace(".nim", "")


const cfg = (key) => {
  console.assert(key.length > 0);
  const result = core.getInput(key, {required: true}).trim();
  console.assert(result.length > 0);
  return result;
};


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


function getFilesizeInBytes(filename) {
  if (fs.existsSync(filename)) {
    return fs.statSync(filename).size
  }
  return 0
}


async function checkCollaboratorPermissionLevel(githubClient, levels) {
  const permissionRes = await githubClient.repos.getCollaboratorPermissionLevel({
    owner   : context.repo.owner,
    repo    : context.repo.repo,
    username: context.actor,
  })
  return (permissionRes.status === 200 && levels.includes(permissionRes.data.permission))
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
  // result = result.replace("@github-actions", "")
  if (result.startsWith("@github-actions nim c") || result.startsWith("@github-actions nim cpp") || result.startsWith("@github-actions nim js")) {
    result = result.replace("@github-actions", "")
    result = result + " --run --include:std/prelude --forceBuild:on --colors:off --panics:on --threads:off --verbosity:0 --warning:UnusedImport:off "
    result = result + ` --out:${temporaryOutFile} ${temporaryFile}`
    return result.trim()
  } else {
    core.setFailed("Github comment must start with '@github-actions nim c' or '@github-actions nim cpp' or '@github-actions nim js'")
  }
};


function executeShebangScript(cmd, codes) {
  fs.writeFileSync(temporaryFile, codes)
  console.log("COMMAND:\t", cmd)
  try {
    return execSync(cmd).toString().trim()
  } catch (error) {
    core.setFailed(error)
    return ""
  }
}


if (context.eventName === "issue_comment") {
  const commentPrefix = "@github-actions nim"
  const githubToken = cfg('github-token')
  const githubClient = new GitHub(githubToken)
  // Check if we have permissions.
  if (checkCollaboratorPermissionLevel(githubClient, ['admin', 'write', 'read'])) {
    const githubComment = context.payload.comment.body.trim()
    // Check if github comment starts with commentPrefix.
    if (githubComment.startsWith(commentPrefix)) {
      const codes = parseGithubComment(githubComment)
      const cmd = parseGithubCommand(githubComment)
      // Add Reaction of "Eyes" as seen.
      if (addReaction(githubClient, "eyes")) {
        const started  = new Date()  // performance.now()
        const output   = executeShebangScript(cmd, codes)
        const finished = new Date()  // performance.now()
        // Add Reaction of "+1" if success or "-1" if fails.
        if (addReaction(githubClient, (output.length > 0 ? "+1" : "-1"))) {
          // Report results back as a comment on the issue.
          addIssueComment(githubClient, `
@${ context.actor } (${ context.payload.comment.author_association.toLowerCase() })
<details open=true >
  <summary>Output</summary>
  <code>${output}</code>
</details>
<details>
  <summary>Bench</summary>
  <b>created </b>  <code>${ context.payload.comment.created_at }</code><br>
  <b>started </b>  <code>${ started.toISOString().split('.').shift()  }</code><br>
  <b>finished</b>  <code>${ finished.toISOString().split('.').shift() }</code><br>
  <b>duration</b>  <code>${ finished - started }</code> milliseconds (${ formatDuration((((finished - started) % 60000) / 1000).toFixed(0)) })<br>
  <b>filesize</b>  <code>${ getFilesizeInBytes(temporaryOutFile) }</code> bytes<br>
  <b>command </b>  <code>${ cmd.replace(`--out:${temporaryOutFile} ${temporaryFile}`, "") }</code><br>
</details>`)
        }
      }
    }
  }
}
