'use strict';
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const core     = require('@actions/core');
const marked   = require('marked')
const { execSync } = require('child_process');
const {context, GitHub} = require('@actions/github')


const startedDatetime  = new Date()
const tripleBackticks  = "```"
const gitTempPath      = `${ process.cwd() }/Nim`
const temporaryFile    = `${ process.cwd() }/temp.nim`
const temporaryFile2   = `${ process.cwd() }/dumper.nim`
const temporaryFileAsm = `${ process.cwd() }/@mtemp.nim.c`
const temporaryOutFile = temporaryFile.replace(".nim", "")
const preparedFlags    = ` --nimcache:${ process.cwd() } --out:${temporaryOutFile} ${temporaryFile}`
const extraFlags       = " -d:useMalloc -d:nimArcDebug -d:nimArcIds -d:nimDebugDlOpen -d:stacktraceMsgs -d:nimCompilerStacktraceHints -d:ssl -d:nimDisableCertificateValidation --debugger:native --forceBuild:on --debuginfo:on --colors:off --verbosity:0 --hints:off --warnings:off --lineTrace:off "
const nimFinalVersions = ["devel", "stable", "1.6.0", "1.4.0", "1.2.0", "1.0.0", "0.20.2"]
const choosenimNoAnal  = {env: {...process.env, CHOOSENIM_NO_ANALYTICS: "1", SOURCE_DATE_EPOCH: Math.floor(Date.now() / 1000).toString()}}  // SOURCE_DATE_EPOCH is same in all runs.
const valgrindLeakChck = {env: {...process.env, VALGRIND_OPTS: "--tool=memcheck --leak-check=full --show-leak-kinds=all --undef-value-errors=yes --track-origins=yes --show-error-list=yes --keep-debuginfo=yes --show-emwarns=yes --demangle=yes --smc-check=none --num-callers=9 --max-threads=9"}}
const debugGodModes    = ["araq"]
const unlockedAllowAll = true  // true == Users can Bisect  |  false == Only Admins can Bisect.
const commentPrefix = "!nim "


const cfg = (key) => {
  console.assert(typeof key === "string", `key must be string, but got ${ typeof key }`)
  const result = core.getInput(key, {required: true}).trim()
  console.assert(typeof result === "string", `result must be string, but got ${ typeof result }`)
  return result;
};


const indentString = (str, count = 2, indent = ' ') => {
  return str.replace(/^/gm, indent.repeat(count))
}


function formatDuration(seconds) {
  if (typeof seconds === "string") {
    seconds = parseInt(seconds, 10)
  }
  console.assert(typeof seconds === "number", `seconds must be number, but got ${ typeof seconds }`)
  let result = "now"
  if (!isNaN(seconds) && seconds > 0) {
      const hours   = Math.floor(((seconds % 31536000) % 86400) / 3600);
      const minutes = Math.floor(((seconds % 31536000) % 86400) %  60);
      const second  = (((seconds % 31536000) % 86400)  % 3600)  % 0;
      const y = (hours   > 0) ? hours   + " hours"   : "";
      const z = (minutes > 0) ? minutes + " minutes" : "";
      const u = (second  > 0) ? second  + " seconds" : "";
      result = y + z + u
  }
  console.assert(typeof result === "string", `result must be string, but got ${ typeof result }`)
  return result
}


function formatSizeUnits(bytes) {
  console.assert(typeof bytes === "number", `bytes must be number, but got ${ typeof bytes }`)
  const bites = ` (${ bytes.toLocaleString() } bytes)`
  if      (bytes >= 1073741824) { bytes = (bytes / 1073741824).toFixed(2) + " Gb"; }
  else if (bytes >= 1048576)    { bytes = (bytes / 1048576).toFixed(2) + " Mb"; }
  else if (bytes >= 1024)       { bytes = (bytes / 1024).toFixed(2) + " Kb"; }
  else if (bytes >  1)          { bytes = bytes + " bytes"; }
  else if (bytes == 1)          { bytes = bytes + " byte"; }
  else                          { bytes = "0 bytes"; }
  return bytes + bites;
}


function getFilesizeInBytes(filename) {
  console.assert(typeof filename === "string", `filename must be string, but got ${ typeof filename }`)
  let result = (fs.existsSync(filename)) ? fs.statSync(filename).size : 0
  console.assert(typeof result === "number", `result must be number, but got ${ typeof filename }`)
  return result
}


function checkAuthorAssociation() {
  const authorPerm = context.payload.comment.author_association.trim().toLowerCase()
  let result = (authorPerm === "owner" || authorPerm === "collaborator" || authorPerm === "member" || debugGodModes.includes(context.payload.comment.user.login.toLowerCase()))
  console.assert(typeof result === "boolean", `result must be boolean, but got ${ typeof result }`)
  return result
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
  return (levels.includes(permissionRes.data.permission) || debugGodModes.includes(context.payload.comment.user.login.toLowerCase()))
};


async function addReaction(githubClient, reaction) {
  console.assert(typeof reaction === "string", `reaction must be string, but got ${ typeof reaction }`)
  return (await githubClient.reactions.createForIssueComment({
    comment_id: context.payload.comment.id,
    content   : reaction.trim().toLowerCase(),
    owner     : context.repo.owner,
    repo      : context.repo.repo,
  }) !== undefined)
};


async function addIssueComment(githubClient, issueCommentBody) {
  console.assert(typeof issueCommentBody === "string", `issueCommentBody must be string, but got ${ typeof issueCommentBody }`)
  return (await githubClient.issues.createComment({
    issue_number: context.issue.number,
    owner       : context.repo.owner,
    repo        : context.repo.repo,
    body        : issueCommentBody.trim(),
  }) !== undefined)
};


function parseGithubComment(comment) {
  console.assert(typeof comment === "string", `comment must be string, but got ${ typeof comment }`)
  const tokens = marked.Lexer.lex(comment)
  let result = ""
  for (const token of tokens) {
    if (token.type === 'code' && token.text.length > 0 && token.lang !== undefined) {
      if (token.lang === 'nim') {
        result = token.text.trim()
        result = result.split('\n').filter(line => line.trim() !== '').join('\n')
      } else if (token.lang === 'c') {
        const xtraFile = `${ process.cwd() }/temp.c`
        if (!fs.existsSync(xtraFile)) {
          fs.writeFileSync(xtraFile, token.text.trim())
          fs.chmodSync(xtraFile, "444")
        }
      } else if (token.lang === 'cpp' || token.lang === 'c++') {
        const xtraFile = `${ process.cwd() }/temp.cpp`
        if (!fs.existsSync(xtraFile)) {
          fs.writeFileSync(xtraFile, token.text.trim())
          fs.chmodSync(xtraFile, "444")
        }
      } else if (token.lang === 'h' || token.lang === 'hpp') {
        const xtraFile = `${ process.cwd() }/temp.h`
        if (!fs.existsSync(xtraFile)) {
          fs.writeFileSync(xtraFile, token.text.trim())
          fs.chmodSync(xtraFile, "444")
        }
      } else if (token.lang === 'js' || token.lang === 'javascript') {
        const xtraFile = `${ process.cwd() }/temp.js`
        if (!fs.existsSync(xtraFile)) {
          fs.writeFileSync(xtraFile, token.text.trim())
          fs.chmodSync(xtraFile, "444")
        }
      } else if (token.lang === 'cfg' || token.lang === 'ini') {
        const xtraFile = `${ temporaryFile }.cfg`
        if (!fs.existsSync(xtraFile)) {
          fs.writeFileSync(xtraFile, token.text.trim())
          fs.chmodSync(xtraFile, "444")
        }
      }
    }
  }
  return result
}


function parseGithubCommand(comment) {
  console.assert(typeof comment === "string", `comment must be string, but got ${ typeof comment }`)
  let result = comment.trim().split("\n")[0].trim()
  const bannedSeps = [";", "&&", "||"]
  if (bannedSeps.some(s => result.includes(s))) {
    core.setFailed(`Github comment must not contain ${bannedSeps}`)
  }
  if (result.startsWith("!nim c") || result.startsWith("!nim cpp") || result.startsWith("!nim js")) {
    if (result.startsWith("!nim js")) {
      result = result + " -d:nodejs -d:nimExperimentalAsyncjsThen --run "
    } else if (result.includes("--gc:arc") || result.includes("--gc:orc") || result.includes("--gc:atomicArc")) {
      // If ARC or ORC then add " -d:nimAllocPagesViaMalloc " for Valgrind.
      // "--expandArc:main" can not be used because it was added last.
      result = result + " -d:nimAllocPagesViaMalloc "
    }
    result = result + extraFlags + preparedFlags
    if (result.startsWith("!nim c") || result.startsWith("!nim cpp")) {
      // If Valgrind is installed, then use Valgrind, else just run it.
      result = result + ` && valgrind ${temporaryOutFile}`
    }
    result = result.substring(1) // Remove the leading "!"
    console.assert(typeof result === "string", `result must be string, but got ${ typeof result }`)
    return result.trim()
  } else {
    core.setFailed("Github comment must start with '!nim c' or '!nim cpp' or '!nim js'")
  }
};


function executeChoosenim(semver) {
  console.assert(typeof semver === "string", `semver must be string, but got ${ typeof semver }`)
  for (let i = 0; i < 3; i++) {
    try {
      const result = execSync(`choosenim --noColor --skipClean --yes update "${semver}"`, choosenimNoAnal).toString().trim()
      if (result) {
        return result
      }
    } catch (error) {
      console.warn(error)
      if (i === 2) {
        console.warn('choosenim failed >3 times, giving up...')
        return ""
      }
    }
  }
}


function executeNim(cmd, codes) {
  console.assert(typeof cmd === "string", `cmd must be string, but got ${ typeof cmd }`)
  console.assert(typeof codes === "string", `codes must be string, but got ${ typeof codes }`)
  if (!fs.existsSync(temporaryFile)) {
    fs.writeFileSync(temporaryFile, codes)
    fs.chmodSync(temporaryFile, "444")
  }
  console.log("COMMAND:\t", cmd)
  try {
    return [true, execSync(cmd, valgrindLeakChck).toString().trim()]
  } catch (error) {
    console.warn(error)
    return [false, `${error}`]
  }
}


function executeAstGen(codes) {
  console.assert(typeof codes === "string", `codes must be string, but got ${ typeof codes }`)
  fs.writeFileSync(temporaryFile2, `dumpAstGen:\n${ indentString(codes) }`)
  try {
    return execSync(`nim check --verbosity:0 --hints:off --warnings:off --colors:off --lineTrace:off --forceBuild:on --import:std/macros ${temporaryFile2}`).toString().trim()
  } catch (error) {
    console.warn(error)
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
  console.assert(typeof result === "string", `result must be string, but got ${ typeof result }`)
  return result
}


function gitInit() {
  // Git clone Nim repo and checkout devel
  if (!fs.existsSync(gitTempPath)) {
    console.log(execSync(`git clone https://github.com/nim-lang/Nim.git ${gitTempPath}`).toString())
    console.log(execSync("git config --global advice.detachedHead false && git checkout devel", {cwd: gitTempPath}).toString())
  }
}


function gitMetadata(commit) {
  // Git get useful metadata from current commit
  console.assert(typeof commit === "string", `commit must be string, but got ${ typeof commit }`)
  console.log(execSync(`git checkout ${ commit.replace("#", "") }`, {cwd: gitTempPath}).toString())
  const user   = execSync("git log -1 --pretty=format:'%an'", {cwd: gitTempPath}).toString().trim().toLowerCase()
  const mesage = execSync("git log -1 --pretty='%B'", {cwd: gitTempPath}).toString().trim()
  const date   = execSync("git log -1 --pretty=format:'%ai'", {cwd: gitTempPath}).toString().trim().toLowerCase()
  const files  = execSync("git diff-tree --no-commit-id --name-only -r HEAD", {cwd: gitTempPath}).toString().trim()
  return [user, mesage, date, files]
}


function gitCommitsBetween(commitOld, commitNew) {
  // Git get all commit short hash between commitOld and commitNew
  console.assert(typeof commitOld === "string", `commitOld must be string, but got ${ typeof commitOld }`)
  console.assert(typeof commitNew === "string", `commitNew must be string, but got ${ typeof commitNew }`)
  const result = execSync(`git log --pretty=format:'#%h' ${commitOld}..${commitNew}`, {cwd: gitTempPath}).toString().trim().toLowerCase()
  console.assert(typeof result === "string", `result must be string, but got ${ typeof result }`)
  return result.split('\n')
}


function gitCommitForVersion(semver) {
  // Get Git commit for an specific Nim semver
  console.assert(typeof semver === "string", `semver must be string, but got ${ typeof semver }`)
  let result = null
  semver     = semver.trim().toLowerCase()
  if (semver === "2.0.0") {
    result = "a488067"
  } else if (semver === "1.6.0") {
    result = "727c637"
  } else if (semver === "1.4.0") {
    result = "018ae96"
  } else if (semver === "1.2.0") {
    result = "7e83adf"
  } else if (semver === "1.0.0") {
    result = "f7a8fc4"
  } else if (semver === "0.20.2") {
    result = "88a0edb"
  } else if (semver === "devel" || semver === "stable") {
    // For semver === "devel" or semver === "stable" we use choosenim
    executeChoosenim(semver) // devel and stable are moving targets.
    const nimversion = execSync("nim --version").toString().trim().toLowerCase().split('\n').filter(line => (typeof line === "string" && line.trim() !== ''))
    for (const s of nimversion) {
      if (s.startsWith("git hash:")) {
        result = s.replace("git hash:", "").trim().toLowerCase()
        break
      }
    }
  } else {
    // For semver == "x.x.x" we use Git
    result = execSync(`git checkout "v${semver}" && git rev-parse --short HEAD`, {cwd: gitTempPath}).toString().trim().toLowerCase()
    execSync(`git checkout devel`, {cwd: gitTempPath}) // Go back to devel
  }
  console.assert(typeof result === "string", `result must be string, but got ${ typeof result }`)
  return result
}


// Only run if this is an "issue_comment" and comment startsWith commentPrefix.
if (context.eventName === "issue_comment" && context.payload.comment.body.trim().toLowerCase().startsWith(commentPrefix) && (unlockedAllowAll || checkAuthorAssociation()) ) {
  // Check if we have permissions.
  const githubClient  = new GitHub(cfg('github-token'))
  if (unlockedAllowAll || checkCollaboratorPermissionLevel(githubClient, ['admin', 'write'])) {
      // Add Reaction of "Eyes" as seen.
      if (addReaction(githubClient, "eyes")) {
        const githubComment = context.payload.comment.body.trim()
        const codes         = parseGithubComment(githubComment)
        const cmd           = parseGithubCommand(githubComment)
        let fails           = "devel"
        let works           = null
        let commitsLen      = nimFinalVersions.length
        let issueCommentStr = `@${ context.actor } (${ context.payload.comment.author_association.toLowerCase() })`
        // Check the same code agaisnt all versions of Nim from devel to 1.0
        for (let semver of nimFinalVersions) {
          console.log(executeChoosenim(semver))
          const started  = new Date()
          const [isOk, output] = executeNim(cmd, codes)
          const finished = new Date()
          const thumbsUp = (isOk ? "\t:+1: OK" : "\t:-1: FAIL")
          // Remember which version works and which version breaks.
          if (isOk && works === null) {
            works = semver
          }
          else if (!isOk && fails === "devel") {
            fails = semver
          }
          // Append to reports.
          issueCommentStr += `<details><summary>${semver}\t${thumbsUp}</summary><h3>Output</h3>\n
${ tripleBackticks }
${output}
${ tripleBackticks }\n
<h3>Stats</h3><ul>
<li><b>Created</b>\t<code>${ context.payload.comment.created_at }</code>
<li><b>Started</b>\t<code>${ started.toISOString().split('.').shift()  }</code>
<li><b>Finished</b>\t<code>${ finished.toISOString().split('.').shift() }</code>
<li><b>Duration</b>\t<code>${ formatDuration((((finished - started) % 60000) / 1000)) }</code>
<li><b>Commands</b>\t<code>${ cmd }</code></ul>\n`
          // Iff NOT Ok add AST and IR info for debugging purposes.
          if (!isOk) {
            issueCommentStr += `
<h3>IR</h3><b>Compiled filesize</b>\t<code>${ formatSizeUnits(getFilesizeInBytes(temporaryOutFile)) }</code>\n
${ tripleBackticks }cpp
${ getIR() }
${ tripleBackticks }\n
<h3>AST</h3>\n
${ tripleBackticks }nim
${ executeAstGen(codes) }
${ tripleBackticks }\n`
          }
          issueCommentStr += "</details>\n"
        }


        // This part is about finding the specific commit that breaks
        if (works !== null) {
          // Get a range of commits between "FAILS..WORKS"
          gitInit()
          const failsCommit = gitCommitForVersion(fails)
          const worksCommit = gitCommitForVersion(works)
          if (failsCommit !== null && worksCommit !== null) {
            let commits = gitCommitsBetween(worksCommit, failsCommit)
            commitsLen += commits.length
            // Split commits in half and check if that commit works or fails,
            // then repeat the split there until we got less than 10 commits.
            while (commits.length > 10) {
              let midIndex = Math.ceil(commits.length / 2)
              console.log(executeChoosenim(commits[midIndex]))
              let [isOk, output] = executeNim(cmd, codes)
              if (isOk) {
                // iff its OK then split 0..mid
                commits = commits.slice(0, midIndex);
              } else {
                // else NOT OK then split mid..end
                commits = commits.slice(midIndex);
              }
            }
            let commitsNear = "\n<ul>"
            for (let commit of commits) {
              commitsNear += `<li><a href=https://github.com/nim-lang/Nim/commit/${ commit.replace("#", "") } >${ commit }</a>\n`
            }
            commitsNear += "</ul>\n"
            let bugFound = false
            let index = 0
            for (let commit of commits) {
              // Choosenim switch semver
              console.log(executeChoosenim(commit))
              // Run code
              const [isOk, output] = executeNim(cmd, codes)
              // if this commit works, then previous commit is the breakingCommit
              if (isOk) {
                if (!bugFound) {
                  bugFound = true
                }
                const breakingCommit = (index > 0) ? commits[index - 1] : commits[index]
                const [user, mesage, date, files] = gitMetadata(breakingCommit)
                const comit = breakingCommit.replace('"', '')

                // Report the breaking commit diagnostics
                issueCommentStr += `<details><summary>${comit} :arrow_right: :bug:</summary><h3>Diagnostics</h3>\n
${user} introduced a bug at <code>${date}</code> on commit <a href=https://github.com/nim-lang/Nim/commit/${ comit.replace("#", "") } >${ comit }</a> with message:\n
${ tripleBackticks }
${mesage}
${ tripleBackticks }
\nThe bug is in the files:\n
${ tripleBackticks }
${files}
${ tripleBackticks }
\nThe bug can be in the commits:\n
${commitsNear}
(Diagnostics sometimes off-by-one).\n</details>\n`
                // Break out of the for
                break
              }
              index++
            }
            if (!bugFound) {
              issueCommentStr += `<details><summary>??? :arrow_right: :bug:</summary><h3>Diagnostics</h3>\n
The commit that introduced the bug can not be found, but the bug is in the commits:
${commitsNear}
(Can not find the commit because Nim can not be re-built commit-by-commit to bisect).\n</details>\n`
            }
          }
          else { console.warn("failsCommit and worksCommit not found, at least 1 working commit and 1 non-working commit are required for Bisect commit-by-commit.") }
        }
        else { console.warn("works and fails not found, at least 1 working commit and 1 non-working commit are required for Bisect commit-by-commit.") }
        // Report results back as a comment on the issue.
        const duration = ((( (new Date()) - startedDatetime) % 60000) / 1000)
        issueCommentStr += `:robot: Bug found in <code>${ formatDuration(duration) }</code> bisecting <code>${commitsLen}</code> commits at <code>${ Math.round(commitsLen / duration) }</code> commits per second.`
        addIssueComment(githubClient, issueCommentStr)
    }
    else { console.warn("githubClient.addReaction failed, repo permissions error?.") }
  }
  else { console.log("githubClient.checkCollaboratorPermissionLevel failed, user permissions error?.") }
}
