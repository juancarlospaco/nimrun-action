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


if (context.eventName === "issue_comment") {
  const commentPrefix = "@github-actions run"
  const githubToken = cfg('github-token')
  const githubClient = new GitHub(githubToken)

  if (checkCollaboratorPermissionLevel(githubClient, ['admin', 'write', 'read'])) {
    const githubComment = context.payload.comment.body.trim()
    if (githubComment.startsWith(commentPrefix)) {
      if (addReaction(githubClient, "eyes")) {
        console.warn("HERE!!!");
      }

    }
  }
}
