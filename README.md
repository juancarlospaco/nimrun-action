# Nimrun-Action

- [GitHub Action](https://github.com/features/actions) to compile and run Nim source code from GitHub issue comments code blocks.

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
- `@github-actions` adds 1 new Github issue comment with the Bisect results and stats about your code.

The Bot will match Github issue comments that first line starts with:

- `"!nim c"`
- `"!nim cpp"`
- `"!nim js"`

And followed by a code block of Nim source code.


# Examples

- https://github.com/juancarlospaco/nimrun-action/issues/3#issuecomment-1351871284


# Requisites

- `jiro4989/setup-nim-action` to setup Nim.


# FAQ

- Why not take care of setting up Nim by itself?.

The Bot will change a lot of Nim versions and re-compile Nim commit-by-commit to find the commit that introduced the bug.


<!--
# Security

- Only users with write permissions can run code (Admins and Collaborators with push permissions).
-->
