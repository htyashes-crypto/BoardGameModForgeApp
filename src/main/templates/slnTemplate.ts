import { randomUUID } from 'node:crypto'

/**
 * 生成 .sln 文件内容(最小可被 Cursor/Rider/VS 识别的格式)。
 * 仅含一个 csproj 引用 + 标准 Debug/Release|AnyCPU 配置。
 *
 * **目录布局**:sln 放在 Mod 根,csproj 在 src/ 下。
 *  HelloMod/
 *  ├── HelloMod.sln       ← 本文件位置(IDE 打开 Mod 根时识别此 sln,窗口标题 = Mod 名)
 *  ├── mod.json
 *  └── src/
 *      ├── HelloMod.csproj
 *      └── *.cs
 * sln 内 csproj 路径用 `src\<modName>.csproj` 相对 sln 位置。
 */
export function renderSln(modName: string): string {
  const projectGuid = `{${randomUUID().toUpperCase()}}`
  const solutionGuid = `{${randomUUID().toUpperCase()}}`
  // csharp project type guid
  const csTypeGuid = '{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}'

  return `Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
Project("${csTypeGuid}") = "${modName}", "src\\${modName}.csproj", "${projectGuid}"
EndProject
Global
\tGlobalSection(SolutionConfigurationPlatforms) = preSolution
\t\tDebug|Any CPU = Debug|Any CPU
\t\tRelease|Any CPU = Release|Any CPU
\tEndGlobalSection
\tGlobalSection(ProjectConfigurationPlatforms) = postSolution
\t\t${projectGuid}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
\t\t${projectGuid}.Debug|Any CPU.Build.0 = Debug|Any CPU
\t\t${projectGuid}.Release|Any CPU.ActiveCfg = Release|Any CPU
\t\t${projectGuid}.Release|Any CPU.Build.0 = Release|Any CPU
\tEndGlobalSection
\tGlobalSection(SolutionProperties) = preSolution
\t\tHideSolutionNode = FALSE
\tEndGlobalSection
\tGlobalSection(ExtensibilityGlobals) = postSolution
\t\tSolutionGuid = ${solutionGuid}
\tEndGlobalSection
EndGlobal
`
}
