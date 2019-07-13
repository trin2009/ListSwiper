import { ui } from "../ui/layaMaxUI";

export default class Test2 extends ui.test.Test2UI {
    private dataArr;
    constructor() {
        super();

        this.dataArr = [
            { isEmpty: true, csv: 0 },
            { isEmpty: false, csv: 0 },
            { isEmpty: false, csv: 0 },
            { isEmpty: false, csv: 0 },
            { isEmpty: false, csv: 0 },
            { isEmpty: false, csv: 0 },
            { isEmpty: false, csv: 0 },
            { isEmpty: true, csv: 0 }
        ];
        this.list.scrollBar.tick = 1;
        this.list.scrollBar.changeHandler = Laya.Handler.create(this, this.onScrollValueChange, null, false);
        this.list.renderHandler = Laya.Handler.create(this, this.onItemRender, null, false);
        this.list.array = this.dataArr;
    }

    private onScrollValueChange(v: number) {
        console.log(v);
        this.dataArr.forEach(d => {
            d.csv = v;
        });
        this.list.refresh();
    }

    private onItemRender(cell: Laya.Box, index: number) {
        const img = cell.getChildByName('img') as Laya.Image;
        const lb = cell.getChildByName('lb') as Laya.Label;
        lb.visible = img.visible = !cell.dataSource.isEmpty;
        if (cell.dataSource.isEmpty) {
            return;
        }
        lb.text = '' + index;

        const scaleMin = 0.5;
        const scaleMax = 1;
        const w = cell.width;
        const scaleStep = (scaleMax - scaleMin) / w;
        const maxPoint = (index - 1) * 100;
        const currentScrollValue = cell.dataSource.csv;
        if ((currentScrollValue === maxPoint)) {
            img.scale(1, 1);
            return;
        }
        let delta = Math.abs(currentScrollValue - maxPoint);
        if (delta >= 100) {
            img.scale(0.5, 0.5);
            return;
        }
        const s = 1 - delta * scaleStep;
        img.scale(s, s);
    }
}