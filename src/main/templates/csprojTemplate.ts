export interface CsprojInput {
  /** Mod 名(用作 AssemblyName / RootNamespace);如 CABOGameLogic。 */
  modName: string
  /** Sibling Mod 引用列表(运行时本 Mod 依赖的,需要在 csproj 加 Reference)。 */
  siblingMods: SiblingModRef[]
  /**
   * Mod SDK 路径(主题群「Mod 开发环境作为独立引擎」Phase 3 决策 1=B 绝对路径硬写)。
   *
   * - 用户在 ModForge SettingsModal 配置本机 BoardGameModSDK 路径
   * - 生成 csproj 时 `<ModSdkRoot>` 设为该绝对路径(主源 = ModSdkLib)
   * - 若未配置(undefined / 空),`<ModSdkRoot>` 设为空字符串 → Condition Exists 自动 fallback `$(UnityProjectRoot)Library\ScriptAssemblies\` + Warning
   */
  modSdkPath?: string
}

export interface SiblingModRef {
  /** 被依赖 Mod 的子目录名(物理路径,如 `HtyCoreLib`)。 */
  modDirName: string
  /** dll AssemblyName(通常是 `<modDirName>Behaviour`)。 */
  assemblyName: string
}

/**
 * 生成 Mod 的 .csproj 文件内容。
 *
 * **双模式(主题群「独立桌游包内嵌 Mod SDK」Phase 3 决策 1=A Condition Exists 自动判定)**:
 * - **本工程模式**(默认 / 桌游编辑器开发期):
 *   - SDK dll 走 `$(UnityProjectRoot)Library\ScriptAssemblies\`
 *   - UnityEngine dll 走 `$(UnityEditorInstallPath)Editor\Data\Managed\UnityEngine\`
 * - **Standalone 模式**(纯玩家 Mod 开发期,无源工程 / 无 Unity Editor):
 *   - 所有 dll 统一走 `$(ModSdkLibPath)`(即 `<exe>/ModSdk/Lib/`)
 *
 * 切换由 MSBuild Condition Exists 自动判定,Mod 工程文件无需 regen。
 *
 * **路径锚点**:
 * - `<UnityProjectRoot>` = 5 级 `..` 退回(src → Mod → ModBehaviourProject → 工程 → 桌游工程文件 → BoardGameEditor)
 * - `<ModSdkRoot>` = 3 级 `..` 退回 + `ModSdk\`(src → Mod → Mods → exe 同级 → ModSdk\)
 */
export function renderCsproj(input: CsprojInput): string {
  const assemblyName = `${input.modName}Behaviour`
  const siblingRefs = input.siblingMods
    .map(
      (s) =>
        `    <Reference Include="${s.assemblyName}">
      <HintPath>$(MSBuildThisFileDirectory)..\\..\\${s.modDirName}\\${s.assemblyName}.dll</HintPath>
      <Private>false</Private>
    </Reference>`
    )
    .join('\n')

  const siblingBlock = siblingRefs
    ? `\n    <!-- ===== Sibling Mod 引用(本 Mod 运行时依赖)===== -->\n${siblingRefs}\n`
    : ''

  return `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>netstandard2.1</TargetFramework>
    <LangVersion>9.0</LangVersion>
    <AssemblyName>${assemblyName}</AssemblyName>
    <RootNamespace>${input.modName}</RootNamespace>
    <OutputPath>..\\</OutputPath>
    <AppendTargetFrameworkToOutputPath>false</AppendTargetFrameworkToOutputPath>
    <Nullable>disable</Nullable>
    <NoWarn>CS0649</NoWarn>
  </PropertyGroup>

  <!--
  ModForge 生成的 csproj。
  主题群「独立桌游包内嵌 Mod SDK」Phase 3 双模式:Condition Exists 自动判定。

  目录布局假设(本工程模式):
    <BoardGameEditor>/桌游工程文件/<工程>/ModBehaviourProject/<ModName>/src/<csproj>
                                                                          ↑ csproj 位置
                                                                          5 级 .. 退回 BoardGameEditor

  目录布局假设(Standalone 模式):
    <exe 同级>/Mods/<ModName>/src/<csproj>     ← 玩家自装 Mod
    <exe 同级>/ModSdk/Lib/                      ← SDK dll 集
                                                3 级 .. 退回 <exe 同级>,再加 ModSdk\
  -->

  <PropertyGroup>
    <!-- 本工程模式锚点(桌游开发者本机 fallback 用) -->
    <UnityProjectRoot>$(MSBuildThisFileDirectory)..\\..\\..\\..\\..\\</UnityProjectRoot>

    <!-- Mod SDK 路径(主题群「Mod 开发环境作为独立引擎」Phase 3 决策 1=B 绝对路径硬写) -->
    <ModSdkRoot>${escapeMsbuildPath(input.modSdkPath ?? '')}</ModSdkRoot>
    <ModSdkLibPath>$(ModSdkRoot)Lib\\</ModSdkLibPath>

    <!-- 本工程模式 Unity 引擎 dll 安装目录(可被环境变量 UnityEditorInstallPath 覆盖) -->
    <UnityEditorInstallPath Condition="'$(UnityEditorInstallPath)' == ''">E:\\UnityEditor\\2022.3.62f3c1\\</UnityEditorInstallPath>
    <UnityEngineDllPath>$(UnityEditorInstallPath)Editor\\Data\\Managed\\UnityEngine\\</UnityEngineDllPath>
  </PropertyGroup>

  <!--
    单模式切换(主题群「Mod 开发环境作为独立引擎」Phase 3 决策 1=B + 决策 2=A):
    - 主源 = ModSdkLib:Mod SDK 路径已配置 + dll 存在 → 所有 dll 从 ModSdkLib 拿(Mod 开发者正常路径)
    - 本工程 fallback:ModSdkLib 不存在(桌游开发者本机未导出 ModSDK)→ SDK 走 Library/ScriptAssemblies + Unity dll 走安装目录 + Warning Target 提示
  -->
  <PropertyGroup Condition="Exists('$(ModSdkLibPath)UnityEngine.dll')">
    <ModSdkRef>ModSdkLib</ModSdkRef>
    <SdkHintPath>$(ModSdkLibPath)</SdkHintPath>
    <UnityEngineHintPath>$(ModSdkLibPath)</UnityEngineHintPath>
  </PropertyGroup>
  <PropertyGroup Condition="!Exists('$(ModSdkLibPath)UnityEngine.dll')">
    <ModSdkRef>ProjectFallback</ModSdkRef>
    <SdkHintPath>$(UnityProjectRoot)Library\\ScriptAssemblies\\</SdkHintPath>
    <UnityEngineHintPath>$(UnityEngineDllPath)</UnityEngineHintPath>
  </PropertyGroup>

  <ItemGroup>
    <!-- Unity 引擎 dll -->
    <Reference Include="UnityEngine">
      <HintPath>$(UnityEngineHintPath)UnityEngine.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="UnityEngine.CoreModule">
      <HintPath>$(UnityEngineHintPath)UnityEngine.CoreModule.dll</HintPath>
      <Private>false</Private>
    </Reference>

    <!-- ModObjectBehaviour SDK -->
    <Reference Include="ActFramework.Modding.SDK.ModObjectBehaviour">
      <HintPath>$(SdkHintPath)ActFramework.Modding.SDK.ModObjectBehaviour.dll</HintPath>
      <Private>false</Private>
    </Reference>

    <!-- 富文本 SDK(Fluent builder + Febucci Text Animator tag 常量) -->
    <Reference Include="ActFramework.Modding.SDK.RichText">
      <HintPath>$(SdkHintPath)ActFramework.Modding.SDK.RichText.dll</HintPath>
      <Private>false</Private>
    </Reference>

    <!-- 原子系统(Bg*Ops / Atom*Ops) -->
    <Reference Include="ActFramework.RuntimeAtom">
      <HintPath>$(SdkHintPath)ActFramework.RuntimeAtom.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="BoardGameRuntimeAtom">
      <HintPath>$(SdkHintPath)BoardGameRuntimeAtom.dll</HintPath>
      <Private>false</Private>
    </Reference>

    <!--
      Bg* 编译期常量(由桌游编辑器 LeftMenuPanel "Regenerate BgConstants" 或 Phase 4 bg-codegen.exe 触发产出)。

      Standalone 模式:Bundler 已把 BgGeneratedConstants.dll 拷到 ModSdk/Lib/,走 $(SdkHintPath) 命中。
      本工程模式:走 Shared/Generated/bin/Release/.../ 退路;首次未跑 codegen 时 dll 不存在 → 整 Reference 不命中跳过。
      C# const 编译期 inline,Mod 运行期不需要 BgGeneratedConstants.dll 加载。
    -->
    <Reference Include="BgGeneratedConstants"
               Condition="Exists('$(SdkHintPath)BgGeneratedConstants.dll')">
      <HintPath>$(SdkHintPath)BgGeneratedConstants.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="BgGeneratedConstants"
               Condition="!Exists('$(SdkHintPath)BgGeneratedConstants.dll') and Exists('$(MSBuildThisFileDirectory)..\\..\\Shared\\Generated\\bin\\Release\\netstandard2.1\\BgGeneratedConstants.dll')">
      <HintPath>$(MSBuildThisFileDirectory)..\\..\\Shared\\Generated\\bin\\Release\\netstandard2.1\\BgGeneratedConstants.dll</HintPath>
      <Private>false</Private>
    </Reference>${siblingBlock}
  </ItemGroup>

  <!--
    诊断 + Warning Target(主题群「Mod 开发环境作为独立引擎」Phase 3 决策 2=A):
    - ModSdkRef=ModSdkLib 时:正常路径,Message 输出当前 ModSdkRoot
    - ModSdkRef=ProjectFallback 时:Warning 提示从 GitHub 下载 ModSDK 走主源
  -->
  <Target Name="DiagnoseModSdkRef" BeforeTargets="BeforeBuild">
    <Message Importance="high" Text="[ModForge csproj] ModSdkRef=$(ModSdkRef) | SdkHintPath=$(SdkHintPath) | UnityEngineHintPath=$(UnityEngineHintPath)" />
  </Target>
  <Target Name="WarnIfFallback" BeforeTargets="BeforeBuild" Condition="!Exists('$(ModSdkLibPath)UnityEngine.dll')">
    <Warning Text="未检测到 Mod SDK Lib(\$(ModSdkRoot)Lib\\),build 退化到本工程路径(\$(UnityProjectRoot)Library\\ScriptAssemblies\\)。建议从 https://github.com/htyashes-crypto/BoardGameModSDK 下载 BoardGameModSDK 并在 ModForge SettingsModal 内配置 Mod SDK 路径,以脱离本工程目录结构依赖。" />
  </Target>

</Project>
`
}

/** MSBuild XML 路径转义:正斜杠 → 反斜杠;尾部确保有 \(让 $(ModSdkRoot)Lib\\ 合法)。 */
function escapeMsbuildPath(absPath: string): string {
  if (!absPath) return ''
  const normalized = absPath.replace(/\//g, '\\')
  return normalized.endsWith('\\') ? normalized : normalized + '\\'
}
