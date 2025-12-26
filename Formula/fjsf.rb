class Fjsf < Formula
  desc "CLI tool for fuzzy searching npm scripts and JSON files"
  homepage "https://github.com/yowainwright/fjsf"
  version "0.2.7"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-qjs-darwin-arm64"
      sha256 "d8d0492fff5e3b7ac5cfab3eff250c92384a5f12533a3d9828bb8433497d034b" # arm64
    end
  end

  on_linux do
    url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-qjs-linux-x64"
    sha256 "361fa51aa2cde7f19c4b19a4131b13624fa28f6170d6d4695ef5487900972080" # linux
  end

  def install
    bin.install Dir["fjsf-qjs-*"].first => "fjsf"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/fjsf --version")
  end
end
