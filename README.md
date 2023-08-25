# Nimrun-Action

- [GitHub Action](https://github.com/features/actions) to bisect bugs commit-by-commit from GitHub issue comments code blocks.

https://user-images.githubusercontent.com/1189414/207674682-c971f842-b4ef-42a3-81b2-62e1c378d5a4.mp4


The bot will run the provided code on all Nim final versions from `1.0.0` to `devel`,
then finds at least 1 commit that fails and finds at least 1 commit that works,
bisects commit-by-commit between that range of commits (FAILS..WORKS),
re-builds Nim commit-by-commit and runs the code checking if it works,
until it finds 1 specific commit that introduces the Bug,
it says who, when, why, link, and files with the bug,
also reports debug info like output, IR (C/JS), AST, date/time/duration,
compiled file size, commits near with link, commits per second, etc.

Users can Bisect their own bugs, core devs get the commit that introduced the bug.

**The reduced bug repro code sample should be as tiny and simple as possible for faster performance but must have asserts.**

The Bot will match Github issue comments that first line starts with:

- `"!nim c"`
- `"!nim cpp"`
- `"!nim js"`

And followed by 1 code block of Nim source code.


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
      - name: Install Dependencies
        run: sudo apt-get install --no-install-recommends -yq valgrind
      - uses: juancarlospaco/nimrun-action@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

- `@github-actions` adds :eyes: Reaction to your Github issue comment when seen.
- `@github-actions` adds 1 new Github issue comment with the Bisect results and stats.


# Examples

Used by Nim official repo:

- https://github.com/nim-lang/Nim/issues/16933#issuecomment-1620907872
- https://github.com/nim-lang/Nim/pull/22157#issuecomment-1620858856


# Valgrind

- Iff using ARC/ORC/AtomicARC and `-d:useMalloc` then uses Valgrind.
- Example `!nim c --gc:arc -d:useMalloc` (automatically sets `--debugger:native` etc).
- https://github.com/juancarlospaco/nimrun-action/pull/4


# Fuzzing

- Static basic [Fuzzing](https://en.wikipedia.org/wiki/Fuzzing) for primitive types for C/C++/JS targets.
- Example https://github.com/juancarlospaco/nimrun-action/issues/3#issuecomment-1673682776

```nim
random.randomize()
type O = enum A, B
echo O.fuzzing
echo int.fuzzing
echo int64.fuzzing
echo int32.fuzzing
echo int16.fuzzing
echo int8.fuzzing
echo uint64.fuzzing
echo uint32.fuzzing
echo uint16.fuzzing
echo uint8.fuzzing
echo byte.fuzzing
echo char.fuzzing
echo repr(BackwardsIndex.fuzzing)
echo bool.fuzzing
echo float.fuzzing
echo float64.fuzzing
echo float32.fuzzing
echo Positive.fuzzing
echo Natural.fuzzing
echo string.fuzzing
echo cstring.fuzzing
```


# Multiple files

If you want to provide additional files:

- Add 1 new code block with C syntax to be saved as `./temp.c`.
- Add 1 new code block with C++ syntax to be saved as `./temp.cpp`.
- Add 1 new code block with C Header syntax to be saved as `./temp.h`.
- Add 1 new code block with HPP Header syntax to be saved as `./temp.hpp`.
- Add 1 new code block with JS syntax to be saved as `./temp.js`.
- Add 1 new code block with JSON syntax to be saved as `./temp.json`.
- Add 1 new code block with TXT syntax to be saved as `./temp.txt`.
- Add 1 new code block with CFG syntax to be saved as `./temp.nim.cfg`.

For additional Nim source code files provide additional Nim code blocks,
the first Nim code block will always be the main executable named `./temp.nim`,
and additional Nim code blocks will be importable modules named as `./tempN.nim`,
with `N` being an incrementing positive integer starting with `./temp1.nim`, 
then `./temp2.nim`, `./temp3.nim`, `./temp4.nim`, etc.

- Example https://github.com/nim-lang/Nim/issues/22543#issuecomment-1690562542


# Arbitrary text comment

Comment must start with the `!nim ` because it checks the first line only for performance for fast builds,
you can have any arbitrary text and links **after** the code blocks (or write the text on another comment).

- Example https://github.com/nim-lang/Nim/pull/22559#issuecomment-1693758090


# Requisites

- `jiro4989/setup-nim-action` to setup Nim.


# Articles

- https://nim-lang.org/blog/2023/01/11/this-month-with-nim.html


<!--
# Security

- Only users with write permissions can run code (Admins and Collaborators with push permissions).
-->


# Stars

![](https://starchart.cc/juancarlospaco/nimrun-action.svg)
:star: [@juancarlospaco](https://github.com/juancarlospaco '2023-07-06')
:star: [@moigagoo](https://github.com/moigagoo '2023-07-06')	
:star: [@planetis-m](https://github.com/planetis-m '2023-07-06')	
:star: [@geotre](https://github.com/geotre '2023-07-07')	
:star: [@georgelemon](https://github.com/georgelemon '2023-07-07')	
:star: [@gabbhack](https://github.com/gabbhack '2023-07-07')	
:star: [@termermc](https://github.com/termermc '2023-07-10')	
:star: [@solarizedalias](https://github.com/solarizedalias '2023-07-15')	
