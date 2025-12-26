class Fjsf < Formula
  desc "CLI tool for fuzzy searching npm scripts and JSON files"
  homepage "https://github.com/yowainwright/fjsf"
  version "0.2.8"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-qjs-darwin-arm64"
      sha256 "ac0fdf0a15bd942f1e1303bcf08f03ffb350c78259165fc9cbedaa68ee218fcf" # arm64
    end
  end

  on_linux do
    url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-qjs-linux-x64"
    sha256 "11d6f342d551a5c9b948d5c90bfbfbd11f2fa438ef4b3d3320adc0edb20314f7" # linux
  end

  def install
    bin.install Dir["fjsf-qjs-*"].first => "fjsf"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/fjsf --version")
  end
end
