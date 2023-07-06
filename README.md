# Nimrun-Action

- [GitHub Action](https://github.com/features/actions) to bisect commit-by-commit from GitHub issue comments code blocks.

https://user-images.githubusercontent.com/1189414/207674682-c971f842-b4ef-42a3-81b2-62e1c378d5a4.mp4


![](https://raw.githubusercontent.com/juancarlospaco/nimrun-action/nim/screenshot.png)


# Setup

- Go to https://github.com/USER/REPO/settings/actions
- Find "Workflow permissions" section.
- Enable "Read and write permissions".


# Use

```yaml
on:
  issue_comment:
    types: created
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - uses: jiro4989/setup-nim-action@v1
        with:
          nim-version: 'devel'
      - uses: juancarlospaco/nimrun-action@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

- `@github-actions` adds :eyes: Reaction to your Github issue comment when seen.
- `@github-actions` adds 1 new Github issue comment with the Bisect results and stats.

The bot will run the code on all Nim final versions from `1.0.0` to `devel`,
finds at least 1 commit that fails and finds at least 1 commit that works,
bisects commit-by-commit between that range of commits (FAILS..WORKS),
re-builds Nim commit-by-commit and runs the code checking if it works,
until it finds the specific commit that introduces the Bug.

Users can Bisect their own bugs, core devs get the commit that introduced the bug.

The Bot will match Github issue comments that first line starts with:

- `"!nim c"`
- `"!nim cpp"`
- `"!nim js"`

And followed by a code block of Nim source code.


# Examples

Actually used in Nim official repo:

- https://github.com/nim-lang/Nim/issues/16933#issuecomment-1620907872
- https://github.com/nim-lang/Nim/pull/22157#issuecomment-1620858856


# Requisites

- `jiro4989/setup-nim-action` to setup Nim.


# FAQ

- Why not take care of setting up Nim by itself?.

The Bot will change a lot of Nim versions and re-compile Nim commit-by-commit to find the commit that introduced the bug.


<!--
# Security

- Only users with write permissions can run code (Admins and Collaborators with push permissions).
-->
