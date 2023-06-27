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

- Nim version to use depends on `nim-version` of `jiro4989/setup-nim-action`.
- `@github-actions` adds :eyes: Reaction to your Github issue comment when seen.
- `@github-actions` adds :+1: Reaction to your Github issue comment when your code compiles and runs OK.
- `@github-actions` adds :-1: Reaction to your Github issue comment when your code fails to run.
- `@github-actions` adds 1 new Github issue comment with the results and stats about your code.

The Bot will match Github issue comments that starts with:

- `"@github-actions nim c"`
- `"@github-actions nim cpp"`
- `"@github-actions nim js"`
- `"@github-actions nim e"`

And followed by a code block of Nim source code.


# Examples

- https://github.com/juancarlospaco/nimrun-action/issues/3#issuecomment-1351871284


# Security

- Only users with write permissions can run code (Admins and Collaborators with push permissions).


# Requisites

- `jiro4989/setup-nim-action` to setup Nim.


# FAQ

- Why not take care of setting up Nim by itself?.

Because some people already do it with just Git or Choosenim or setup-nim-action.
