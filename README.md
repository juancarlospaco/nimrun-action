# Nimrun-Action

- [GitHub Action](https://github.com/features/actions) to compile and run Nim source code from GitHub issue comments code blocks.

![](screenshot.png)



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


# Requisites

- `jiro4989/setup-nim-action` to setup Nim.


# FAQ

- Why not take care of setting up Nim by itself?.

Because some people already do it with just Git or Gitnim or Choosenim or setup-nim-action.
