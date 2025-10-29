class Fjsf < Formula
  desc "CLI tool for fuzzy searching npm scripts and JSON files"
  homepage "https://github.com/yowainwright/fjsf"
  version "0.0.2"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-darwin-arm64"
      sha256 "UPDATE_WITH_ACTUAL_SHA256"
    else
      url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-darwin-x64"
      sha256 "UPDATE_WITH_ACTUAL_SHA256"
    end
  end

  on_linux do
    url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-linux-x64"
    sha256 "UPDATE_WITH_ACTUAL_SHA256"
  end

  def install
    bin.install Dir["fjsf*"].first => "fjsf"
  end

  test do
    assert_match "fjsf - Fuzzy JSON Search & Filter", shell_output("#{bin}/fjsf help")
  end
end
