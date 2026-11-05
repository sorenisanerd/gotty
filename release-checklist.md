# Release checklist

GoTTY releases are tag-driven: pushing an annotated tag starts the workflow
that builds the per-platform tarballs, and the same tag starts the multi-arch
Docker image build. Everything below assumes `gh` is authenticated against the
repository.

1. **Pick the version from the real release line.** `gh release list` is the
   source of truth, not `git tag --sort=-v:refname` — stale pre-1.x `v2.x`
   tags sort above the live `v1.x` line. Minor bump for a new flag or feature,
   patch for fixes only.
2. **Rebuild and commit the bundle if `js/src/*` changed**, and make sure
   `make typecheck`, `go vet ./...`, `go test ./...` and `make cross_compile`
   pass. CI gates most of this (`quick-build-test`, `cross-compile-test`,
   `bundle-up-to-date`), so a green PR is the evidence.
3. **Smoke-test by hand what CI does not run a server for:**
   * `gotty bash` works and does not accept input.
   * `gotty -w bash` works and does accept input.
   * The client survives a browser window resize, and the UI changes of this
     release behave (check them on a real browser, desktop and phone).
4. **Audit `## vX.Y.Z (unreleased)` in `NEWS.md` against the commit range** —
   `git log <previous-tag>..HEAD`. Fixes land without a NEWS bullet all the
   time; the section under-reports the release otherwise. User-facing changes
   first, toolchain churn last, and credit code contributors (`Thanks, @user!`).
5. **Refresh the contributor list** (`.all-contributorsrc` and the generated
   block in `README.md`) for anyone new since the last release.
6. **Stamp the date** in `NEWS.md` (`## vX.Y.Z (YYYY-MM-DD)`), commit as
   `Release vX.Y.Z`. Never date an entry before the tag exists.
7. **Tag and push:** `git tag -a vX.Y.Z -m "Release vX.Y.Z"`, then push `main`
   and the tag. Annotated is convention, not a requirement — both workflows
   trigger on any `v*` tag. Tagging drafts the GitHub release (`release.yml`)
   and starts the multi-arch image build (`pre-release.yaml`).
8. **Wait for the image, then verify all three platforms:**
   `docker buildx imagetools inspect sorenisanerd/gotty:vX.Y.Z | grep Platform`.
9. **Replace the draft's auto-generated body with the NEWS section** (keep the
   `**Full Changelog**` compare link), check the asset list matches the
   previous release (one tarball per platform, plus `LICENSE` and
   `SHA256SUMS`), then publish:
   `gh release edit vX.Y.Z --notes-file <file> --draft=false`.
