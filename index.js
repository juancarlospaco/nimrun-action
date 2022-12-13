'use strict';
const fs       = require('fs');
const path     = require('path');
const core     = require('@actions/core');
const { exec } = require('child_process');
const {context, GitHub} = require('@actions/github')
const marked = require('marked')


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
    content   : reaction,
    owner     : context.repo.owner,
    repo      : context.repo.repo,
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
  result = result.replace("nim r ", "nim r --import:std/prelude ")
  result = result.replace(" -r ", " ")
  result = result + " ./temp.nim"
  return result.trim()
};


async function executeShebangScript(cmd, codes) {
  const pat = "./temp.nim"
  try {
    fs.writeFileSync(pat, codes)
    fs.chmodSync(pat, 0o777)
    // await exec(cmd, [], {outStream: process.stdout, errStream: process.stderr})
    console.log("COMMAND:\t", cmd)
    console.log("CODE:\t", fs.readFileSync(pat).toString() )
    await exec(cmd, (err, stdout, stderr) => {
      if (err) {
        core.setFailed(`${stderr} ${stdout} ${err}`);
        return;
      };
    });
  } finally {
    fs.unlinkSync(pat)
  }
}


if (context.eventName === "issue_comment") {
  const commentPrefix = "@github-actions nim r "
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
        executeShebangScript(cmd, codes)
        if (addReaction(githubClient, "+1")) {
          // console.warn(codes);
        }
      }
    }
  }
}
