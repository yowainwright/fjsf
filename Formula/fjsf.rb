class Fjsf < Formula
  desc "CLI tool for fuzzy searching npm scripts and JSON files"
  homepage "https://github.com/yowainwright/fjsf"
  version "0.2.10"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-qjs-darwin-arm64"
      sha256 "f5bc7678f1fefce113fb7f101f43fb854a9ed5373bf217d9f52019f460917a3b" # arm64
    end
  end

  on_linux do
    url "https://github.com/yowainwright/fjsf/releases/download/v#{version}/fjsf-qjs-linux-x64"
    sha256 "c65215e80e19b621ac3c8abb09dea14cf9a32d9a42e9c8ef6058e64fbc5422d9" # linux
  end

  def install
    bin.install Dir["fjsf-qjs-*"].first => "fjsf"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/fjsf --version")
  end
end
