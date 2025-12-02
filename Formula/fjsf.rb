class Fjsf < Formula
  desc "CLI tool for fuzzy searching npm scripts and JSON files"
  homepage "https://github.com/yowainwright/fjsf"
  version "0.2.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-qjs-darwin-arm64"
      sha256 "UPDATE_AFTER_FIRST_RELEASE"
    else
      url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-qjs-darwin-x64"
      sha256 "UPDATE_AFTER_FIRST_RELEASE"
    end
  end

  on_linux do
    url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-qjs-linux-x64"
    sha256 "UPDATE_AFTER_FIRST_RELEASE"
  end

  def install
    bin.install Dir["fjsf-qjs-*"].first => "fjsf"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/fjsf --version")
  end
end
