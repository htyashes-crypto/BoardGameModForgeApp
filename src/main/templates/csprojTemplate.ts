export interface CsprojInput {
  /** Mod 名(用作 AssemblyName / RootNamespace);如 CABOGameLogic。 */
  modName: string
  /** Sibling Mod 引用列表(运行时本 Mod 依赖的,需要在 csproj 加 Reference)。 */
  siblingMods: SiblingModRef[]
}

export interface SiblingModRef {
  /** 被依赖 Mod 的子目录名(物理路径,如 `HtyCoreLib`)。 */
  modDirName: string
  /** dll AssemblyName(通常是 `<modDirName>Behaviour`)。 */
  assemblyName: string
}

/**
 * 生成 Mod 的 .csproj 文件内容。
 * - UnityProjectRoot 用 `$(MSBuildThisFileDirectory)..\..\..\..\..\` 相对路径,消除盘符硬编码
 * - 输出 dll 到上一级(`OutputPath=..\`)
 * - sibling Mod 用 Reference + HintPath `..\..\<modDir>\<AssemblyName>.dll`
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
  ModForge 生成的 csproj。UnityProjectRoot 用 MSBuildThisFileDirectory 相对推断,
  无需手工修改盘符;仅当目录布局变动时才需调整路径深度。
  目录布局假设:<BoardGameEditor>/桌游工程文件/<工程>/ModBehaviourProject/<ModName>/src/
                    ↑                                                            ↑ csproj 位置
                    五级 .. 退回
  -->

  <PropertyGroup>
    <UnityProjectRoot>$(MSBuildThisFileDirectory)..\\..\\..\\..\\..\\..\\</UnityProjectRoot>
  </PropertyGroup>

  <ItemGroup>
    <!-- Unity 编译产物(必需) -->
    <Reference Include="UnityEngine">
      <HintPath>$(UnityProjectRoot)Library\\ScriptAssemblies\\UnityEngine.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="UnityEngine.CoreModule">
      <HintPath>$(UnityProjectRoot)Library\\ScriptAssemblies\\UnityEngine.CoreModule.dll</HintPath>
      <Private>false</Private>
    </Reference>

    <!-- ModObjectBehaviour SDK -->
    <Reference Include="ActFramework.Modding.SDK.ModObjectBehaviour">
      <HintPath>$(UnityProjectRoot)Library\\ScriptAssemblies\\ActFramework.Modding.SDK.ModObjectBehaviour.dll</HintPath>
      <Private>false</Private>
    </Reference>

    <!-- 原子系统(Bg*Ops / Atom*Ops) -->
    <Reference Include="ActFramework.RuntimeAtom">
      <HintPath>$(UnityProjectRoot)Library\\ScriptAssemblies\\ActFramework.RuntimeAtom.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="BoardGameRuntimeAtom">
      <HintPath>$(UnityProjectRoot)Library\\ScriptAssemblies\\BoardGameRuntimeAtom.dll</HintPath>
      <Private>false</Private>
    </Reference>${siblingBlock}
  </ItemGroup>

</Project>
`
}
