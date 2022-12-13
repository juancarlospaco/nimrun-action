# Nimlint-Action

- [GitHub Action](https://github.com/features/actions) to auto-lint all your Nim source code files using [nimlint](https://github.com/nim-compiler-dev/nimlint).


# Examples

- https://github.com/juancarlospaco/nimlint-action/runs/1527448356?check_suite_focus=true#step:4:9
- https://github.com/juancarlospaco/nimlint-action/runs/1527464129?check_suite_focus=true#step:4:9


# Use

```yaml
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - uses: jiro4989/setup-nim-action@v1
        with:
          nim-version: 'devel'
      - uses: juancarlospaco/nimlint-action@main
```


# Options

- `folders` Comma separated list of folders, optional, defaults to `"."`.
- `verbose` Verbose, optional, boolean, defaults to `false`.


Examples:

```yml
- uses: juancarlospaco/nimlint-action@main
  with:
    folders: "src,examples,tutorial,lib"
```


```yml
- uses: juancarlospaco/nimlint-action@main
  with:
    folders: "src"
```


# Requisites

- `jiro4989/setup-nim-action` to setup Nim.
- `EndBug/add-and-commit` to commit all nimlint fixes back to the Git repo.


# FAQ

- Why not take care of setting up Nim by itself?.

Because some people already do it with just Git or Gitnim or Choosenim or setup-nim-action.

- Why not take care of commiting the files by itself?.

Because some people already do it with `EndBug/add-and-commit` or `stefanzweifel/git-auto-commit-action` or `github-actions/auto-commit`.
