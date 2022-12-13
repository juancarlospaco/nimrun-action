'use strict';
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const core     = require('@actions/core');
const { execSync } = require('child_process');
const {context, GitHub} = require('@actions/github')
const marked = require('marked')
const temporaryFile = `${ process.cwd() }/temp.nim`


const cfg = (key) => {
  console.assert(key.length > 0);
  const result = core.getInput(key, {required: true}).trim();
  console.assert(result.length > 0);
  return result;
};


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
  result = result.replace("@github-actions", "")
  // result = result.replace("nim r ", "nim r --import:std/prelude ")
  result = result.replace(" -r ", " ")
  result = result + " " + temporaryFile
  return result.trim()
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
  const commentPrefix = "@github-actions nim r"
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
        console.log("OK_OUTPUT\t", output)
        if (addReaction(githubClient, (output.length > 0 ? "+1" : "-1"))) {
          console.warn("HERE");
          const comment = `
          <details>
            <summary>Bench</summary>
            <b>started </b>  <code>${ started.toISOString().split('.').shift()  }</code><br>
            <b>finished</b>  <code>${ finished.toISOString().split('.').shift() }</code><br>
            <b>duration</b>  <code>${ finished.getTime() - started.getTime()    }</code> Milliseconds<br>
          </details>
          <code>${output}</code>
          `
          addIssueComment(githubClient, comment)
        }
      }
    }
  }
}
