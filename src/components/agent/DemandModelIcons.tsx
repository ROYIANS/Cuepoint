import {type ComponentType, type CSSProperties, lazy, memo, useMemo} from "react";
import type {ModelIconProps} from "@lobehub/icons/es/features/ModelIcon";
import type {ProviderIconProps} from "@lobehub/icons/es/features/ProviderIcon";
import ModelDefaultAvatar from "@lobehub/icons/es/features/ModelIcon/DefaultAvatar";
import ModelDefaultIcon from "@lobehub/icons/es/features/ModelIcon/DefaultIcon";
import ProviderDefaultAvatar from "@lobehub/icons/es/features/ProviderIcon/DefaultAvatar";
import ProviderDefaultIcon from "@lobehub/icons/es/features/ProviderIcon/DefaultIcon";
import {brandLoaders, modelMappings, providerMappings} from "./ModelIconMapping.generated";

type RenderProps = {
    size: number;
    shape?: "circle" | "square";
    className?: string;
    style?: CSSProperties;
    type?: string
};
type IconComponent = ComponentType<RenderProps>;
type BrandIcon = IconComponent & {
    Avatar: IconComponent;
    Color?: IconComponent;
    Combine?: IconComponent;
    Brand?: IconComponent;
    BrandColor?: IconComponent;
    Text?: IconComponent
};
type IconType = NonNullable<ModelIconProps["type"]>;
type BrandProps = { renderType: IconType; props: RenderProps; lobeColor?: boolean };
type Brand = keyof typeof brandLoaders;
const lazyBrands = new Map<Brand, ReturnType<typeof lazy<IconComponentForBrand>>>();
type IconComponentForBrand = ComponentType<BrandProps>;

// Each compound brand remains the publisher's real implementation. Select its
// variant only after loading that brand, retaining the original fallback order.
function renderBrand(Icon: BrandIcon, {renderType, props, lobeColor}: BrandProps) {
    switch (renderType) {
        case "avatar":
            return <Icon.Avatar {...props}/>;
        case "mono": {
            const Render = lobeColor ? Icon.Color! : Icon;
            return <Render {...props}/>;
        }
        case "color": {
            const Render = Icon.Color ?? Icon;
            return <Render {...props}/>;
        }
        case "combine": {
            const Render = Icon.Combine ?? Icon.Brand ?? Icon.Text ?? Icon;
            return <Render {...(Icon.Combine ? {type: "mono"} : {})} {...props}/>;
        }
        case "combine-color": {
            const Render = Icon.Combine ?? Icon.BrandColor ?? Icon.Text ?? Icon;
            return <Render {...(Icon.Combine ? {type: "color"} : {})} {...props}/>;
        }
    }
}

function brandComponent(brand: Brand) {
    let component = lazyBrands.get(brand);
    if (!component) {
        component = lazy(async () => {
            const module = await brandLoaders[brand]();
            // Published compounds have varying brand-specific props. Erase once
            // at this package boundary; catalog and native parity verify it.
            const Icon = module.default as unknown as BrandIcon;
            return {default: (props: BrandProps) => renderBrand(Icon, props)};
        });
        lazyBrands.set(brand, component);
    }
    return component;
}

export const ModelIcon = memo(function ModelIcon({model, size = 12, type = "avatar", shape, ...rest}: ModelIconProps) {
    const match = useMemo(() => model ? modelMappings.find(item => item.keywords.some(keyword => new RegExp(keyword, "i").test(model.toLowerCase()))) : undefined, [model]);
    const props = {size, ...(match && "props" in match ? match.props : {}), ...rest};
    if (!match || !["avatar", "mono", "color", "combine", "combine-color"].includes(type)) {
        return type === "avatar" ? <ModelDefaultAvatar shape={shape} {...props}/> : <ModelDefaultIcon {...props}/>;
    }
    const Render = brandComponent(match.icon);
    return <Render renderType={type} props={type === "avatar" ? {shape, ...props} : props}/>;
});

export const ProviderIcon = memo(function ProviderIcon({
                                                           provider,
                                                           size = 12,
                                                           type = "avatar",
                                                           forceMono,
                                                           shape,
                                                           ...rest
                                                       }: ProviderIconProps) {
    const match = useMemo(() => provider ? providerMappings.find(item => item.keywords.some(keyword => keyword.toLowerCase() === provider.toLowerCase())) : undefined, [provider]);
    const props = {size, ...(match && "props" in match ? match.props : {}), ...rest};
    if (!match || !["avatar", "mono", "color", "combine", "combine-color"].includes(type)) {
        return type === "avatar" ? <ProviderDefaultAvatar shape={shape} {...props}/> :
            <ProviderDefaultIcon {...props}/>;
    }
    const Render = brandComponent(match.icon);
    return <Render renderType={type} props={type === "avatar" ? {shape, ...props} : props}
                   lobeColor={!forceMono && provider === "lobehub"}/>;
});
